import unittest
from unittest.mock import patch
from pathlib import Path
import sys

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.append(str(CURRENT_DIR))

import app


class MockResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}

    def json(self):
        return self._payload


class StudentProfileAppTests(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()

    @patch("app.http_post")
    @patch("app.http_get")
    def test_fetch_reputation_404_initializes_and_retries_get(self, mock_get, mock_post):
        mock_get.side_effect = [
            MockResponse(404, {"error": {"code": "NOT_FOUND"}}),
            MockResponse(200, {"data": {"student_id": 101, "reputation_score": 50}}),
        ]
        mock_post.return_value = MockResponse(
            201, {"data": {"student_id": 101, "reputation_score": 50}}
        )

        score = app.fetch_reputation("section-1", 101)

        self.assertEqual(score, 50)
        self.assertEqual(mock_get.call_count, 2)
        mock_post.assert_called_once_with(app.REPUTATION_URL, payload={"student_id": 101})

    @patch("app.http_post")
    @patch("app.http_get")
    def test_fetch_reputation_404_with_conflict_still_retries(self, mock_get, mock_post):
        mock_get.side_effect = [
            MockResponse(404, {"error": {"code": "NOT_FOUND"}}),
            MockResponse(200, {"data": {"student_id": 102, "score": 50}}),
        ]
        mock_post.return_value = MockResponse(
            409, {"error": {"code": "CONFLICT", "message": "already exists"}}
        )

        score = app.fetch_reputation("section-1", 102)

        self.assertEqual(score, 50)
        self.assertEqual(mock_get.call_count, 2)
        mock_post.assert_called_once_with(app.REPUTATION_URL, payload={"student_id": 102})

    @patch("app.publish_downstream_error")
    @patch("app.http_get")
    def test_fetch_form_data_404_returns_none_without_error_publish(self, mock_get, mock_publish):
        mock_get.return_value = MockResponse(404, {"error": {"code": "NOT_FOUND"}})

        value = app.fetch_form_data("section-1", 103)

        self.assertIsNone(value)
        mock_publish.assert_not_called()

    @patch("app.http_get")
    def test_fetch_topic_preferences_ignores_invalid_rows(self, mock_get):
        mock_get.return_value = MockResponse(
            200,
            {
                "data": [
                    "bad-row",
                    {"topic_id": "topic-2", "rank": 2},
                    {"topic_id": "topic-1", "rank": 1},
                    {"rank": 3},
                ]
            },
        )

        values = app.fetch_topic_preferences("section-1", 104)

        self.assertEqual(values, ["topic-1", "topic-2"])

    @patch("app.http_get")
    def test_fetch_competences_skips_incomplete_rows(self, mock_get):
        mock_get.return_value = MockResponse(
            200,
            {
                "data": [
                    {"skill_id": "python", "skill_level": 4},
                    {"skill_id": "sql"},
                    {"skill_level": 5},
                    "bad-row",
                ]
            },
        )

        values = app.fetch_competences("section-1", 105)

        self.assertEqual(values, [{"skill_id": "python", "skill_level": 4}])

    @patch("app.collect_student_details")
    @patch("app.load_profiles")
    @patch("app.http_get")
    def test_student_profile_endpoint_keeps_null_optional_fields(
        self, mock_get, mock_load_profiles, mock_collect
    ):
        mock_get.return_value = MockResponse(
            200,
            {
                "code": 200,
                "data": [
                    {"student_id": 201},
                    {"student_id": 202},
                ],
            },
        )
        mock_load_profiles.return_value = (
            {
                201: {"name": "A"},
                202: {"name": "B"},
            },
            None,
        )
        mock_collect.side_effect = [
            {
                "buddy_id": None,
                "mbti": None,
                "reputation_score": 50,
                "topic_preferences": None,
                "competences": None,
            },
            {
                "buddy_id": None,
                "mbti": None,
                "reputation_score": None,
                "topic_preferences": None,
                "competences": None,
            },
        ]

        response = self.client.get("/student-profile", query_string={"section_id": "section-1"})

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["code"], 200)
        self.assertEqual(len(body["data"]["students"]), 2)
        self.assertEqual(body["data"]["students"][0]["profile"]["reputation_score"], 50)
        self.assertIsNone(body["data"]["students"][1]["profile"]["topic_preferences"])
        self.assertIsNone(body["data"]["students"][1]["profile"]["competences"])


if __name__ == "__main__":
    unittest.main()
