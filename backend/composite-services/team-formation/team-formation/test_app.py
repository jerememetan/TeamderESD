import unittest
from unittest.mock import patch

import requests

from app import app


class MockResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}

    def json(self):
        return self._payload


class TeamFormationAppTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_missing_section_id_returns_400(self):
        response = self.client.get("/team-formation")

        self.assertEqual(response.status_code, 400)
        body = response.get_json()
        self.assertEqual(body["code"], 400)
        self.assertEqual(body["message"], "section_id is required")

    @patch("app.orchestrate_form_submissions_and_reputation")
    @patch("app.solve_teams")
    @patch("app.requests.get")
    def test_default_success_returns_only_section_and_teams(
        self, mock_get, mock_solve, mock_orchestrate
    ):
        mock_get.side_effect = [
            MockResponse(
                200,
                {"code": 200, "data": {"section_id": "sec-1", "students": []}},
            ),
            MockResponse(
                200,
                {"section_id": "sec-1", "criteria": {"num_groups": 1}, "topics": [], "skills": []},
            ),
        ]
        mock_orchestrate.return_value = (
            {"code": 200, "data": {"section_id": "sec-1", "students": []}},
            None,
        )
        mock_solve.return_value = {
            "status": "OPTIMAL",
            "section_id": "sec-1",
            "num_groups": 1,
            "teams": [{"team_index": 1, "student_ids": [1, 2]}],
            "objective": {"total_score": 5},
            "solver_stats": {"wall_time_s": 1.0},
            "diagnostics": {"warnings": [], "errors": []},
        }

        response = self.client.get("/team-formation?section_id=sec-1")

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["code"], 200)
        self.assertEqual(body["data"]["section_id"], "sec-1")
        self.assertEqual(body["data"]["teams"], [{"team_index": 1, "student_ids": [1, 2]}])
        self.assertNotIn("objective", body["data"])
        self.assertNotIn("solver_stats", body["data"])
        self.assertNotIn("diagnostics", body["data"])

    @patch("app.orchestrate_form_submissions_and_reputation")
    @patch("app.solve_teams")
    @patch("app.requests.get")
    def test_debug_success_includes_extended_fields(self, mock_get, mock_solve, mock_orchestrate):
        mock_get.side_effect = [
            MockResponse(
                200,
                {"code": 200, "data": {"section_id": "sec-2", "students": []}},
            ),
            MockResponse(
                200,
                {"section_id": "sec-2", "criteria": {"num_groups": 1}, "topics": [], "skills": []},
            ),
        ]
        mock_orchestrate.return_value = (
            {"code": 200, "data": {"section_id": "sec-2", "students": []}},
            None,
        )
        mock_solve.return_value = {
            "status": "FEASIBLE",
            "section_id": "sec-2",
            "num_groups": 1,
            "teams": [{"team_index": 1, "student_ids": [10]}],
            "objective": {"total_score": 2},
            "solver_stats": {"wall_time_s": 0.5},
            "diagnostics": {"warnings": [], "errors": []},
        }

        response = self.client.get(
            "/team-formation?section_id=sec-2",
            headers={"X-Debug-Mode": "yes"},
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["code"], 200)
        self.assertEqual(body["data"]["status"], "FEASIBLE")
        self.assertEqual(body["data"]["num_groups"], 1)
        self.assertIn("objective", body["data"])
        self.assertIn("solver_stats", body["data"])
        self.assertIn("diagnostics", body["data"])

    @patch("app.orchestrate_form_submissions_and_reputation")
    @patch("app.requests.get")
    def test_student_profile_downstream_non_2xx_returns_502(self, mock_get, mock_orchestrate):
        mock_get.return_value = MockResponse(500, {"message": "fail"})
        mock_orchestrate.return_value = (None, "failed to process forms")

        response = self.client.get("/team-formation?section_id=sec-3")

        self.assertEqual(response.status_code, 502)
        body = response.get_json()
        self.assertEqual(body["code"], 502)
        self.assertEqual(body["message"], "failed to fetch student profile")

    @patch("app.orchestrate_form_submissions_and_reputation")
    @patch("app.requests.get")
    def test_formation_config_downstream_exception_returns_502(self, mock_get, mock_orchestrate):
        mock_get.side_effect = [
            MockResponse(
                200,
                {"code": 200, "data": {"section_id": "sec-4", "students": []}},
            ),
            requests.RequestException("timeout"),
        ]
        mock_orchestrate.return_value = (None, "failed to process forms")

        response = self.client.get("/team-formation?section_id=sec-4")

        self.assertEqual(response.status_code, 502)
        body = response.get_json()
        self.assertEqual(body["code"], 502)
        self.assertEqual(body["message"], "failed to fetch formation config")

    @patch("app.orchestrate_form_submissions_and_reputation")
    @patch("app.solve_teams")
    @patch("app.requests.get")
    def test_solver_failure_returns_422_without_debug_data(
        self, mock_get, mock_solve, mock_orchestrate
    ):
        mock_get.side_effect = [
            MockResponse(
                200,
                {"code": 200, "data": {"section_id": "sec-5", "students": []}},
            ),
            MockResponse(
                200,
                {"section_id": "sec-5", "criteria": {"num_groups": 2}, "topics": [], "skills": []},
            ),
        ]
        mock_orchestrate.return_value = (
            {"code": 200, "data": {"section_id": "sec-5", "students": []}},
            None,
        )
        mock_solve.return_value = {
            "status": "INVALID_INPUT",
            "section_id": "sec-5",
            "num_groups": 2,
            "teams": [],
            "objective": {"total_score": 0},
            "solver_stats": {},
            "diagnostics": {"errors": ["bad input"], "warnings": []},
        }

        response = self.client.get("/team-formation?section_id=sec-5")

        self.assertEqual(response.status_code, 422)
        body = response.get_json()
        self.assertEqual(body["code"], 422)
        self.assertEqual(body["message"], "team formation could not be generated")
        self.assertNotIn("data", body)

    @patch("app.orchestrate_form_submissions_and_reputation")
    @patch("app.solve_teams")
    @patch("app.requests.get")
    def test_solver_failure_with_debug_includes_data(self, mock_get, mock_solve, mock_orchestrate):
        mock_get.side_effect = [
            MockResponse(
                200,
                {"code": 200, "data": {"section_id": "sec-6", "students": []}},
            ),
            MockResponse(
                200,
                {"section_id": "sec-6", "criteria": {"num_groups": 2}, "topics": [], "skills": []},
            ),
        ]
        mock_orchestrate.return_value = (
            {"code": 200, "data": {"section_id": "sec-6", "students": []}},
            None,
        )
        mock_solve.return_value = {
            "status": "INFEASIBLE",
            "section_id": "sec-6",
            "num_groups": 2,
            "teams": [],
            "objective": {"total_score": 0},
            "solver_stats": {"wall_time_s": 0.1},
            "diagnostics": {"errors": [], "warnings": ["no solution"]},
        }

        response = self.client.get(
            "/team-formation?section_id=sec-6",
            headers={"X-Debug-Mode": "true"},
        )

        self.assertEqual(response.status_code, 422)
        body = response.get_json()
        self.assertEqual(body["code"], 422)
        self.assertIn("data", body)
        self.assertEqual(body["data"]["status"], "INFEASIBLE")
        self.assertIn("diagnostics", body["data"])


if __name__ == "__main__":
    unittest.main()
