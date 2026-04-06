import unittest
from pathlib import Path
import sys
from unittest.mock import patch

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.append(str(CURRENT_DIR))

from team_swap.app import create_app


class TeamSwapConfirmEndpointTests(unittest.TestCase):
    def setUp(self):
        app = create_app()
        self.client = app.test_client()
        self.section_id = "7f7b954e-0cf0-429c-8c01-f780f7c25007"

    @patch("team_swap.routes.swap_routes._fetch_section_row")
    def test_confirm_returns_409_when_section_not_formed(self, mock_fetch_section_row):
        mock_fetch_section_row.return_value = ({"id": self.section_id, "stage": "setup"}, None)

        response = self.client.post(f"/team-swap/sections/{self.section_id}/confirm")

        self.assertEqual(response.status_code, 409)
        body = response.get_json()
        self.assertEqual(body["code"], 409)
        self.assertEqual(body["message"], "section must be in formed stage to confirm swaps")

    @patch("team_swap.routes.swap_routes._update_section_stage")
    @patch("team_swap.routes.swap_routes._fetch_approved_requests")
    @patch("team_swap.routes.swap_routes._fetch_section_teams")
    @patch("team_swap.routes.swap_routes._fetch_section_row")
    def test_confirm_no_approved_requests_returns_zero_summary(
        self,
        mock_fetch_section_row,
        mock_fetch_section_teams,
        mock_fetch_approved_requests,
        mock_update_section_stage,
    ):
        mock_fetch_section_row.return_value = ({"id": self.section_id, "stage": "formed"}, None)
        mock_fetch_section_teams.return_value = ({"team-a": [44, 45]}, {"team-a"}, None)
        mock_fetch_approved_requests.return_value = ([], None)
        mock_update_section_stage.return_value = ({"id": self.section_id, "stage": "confirmed"}, None)

        response = self.client.post(f"/team-swap/sections/{self.section_id}/confirm")

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["code"], 200)
        self.assertEqual(body["data"]["approved_request_count"], 0)
        self.assertEqual(body["data"]["executed_count"], 0)
        self.assertEqual(body["data"]["failed_count"], 0)
        self.assertEqual(body["data"]["message"], "No approved requests; section confirmed")

    @patch("team_swap.routes.swap_routes._update_section_stage")
    @patch("team_swap.routes.swap_routes._update_swap_request_statuses")
    @patch("team_swap.routes.swap_routes._execute_with_preloaded_requests")
    @patch("team_swap.routes.swap_routes._fetch_formation_config")
    @patch("team_swap.routes.swap_routes._fetch_approved_requests")
    @patch("team_swap.routes.swap_routes._fetch_section_teams")
    @patch("team_swap.routes.swap_routes._fetch_section_row")
    def test_confirm_approved_requests_executes_and_returns_summary(
        self,
        mock_fetch_section_row,
        mock_fetch_section_teams,
        mock_fetch_approved_requests,
        mock_fetch_formation_config,
        mock_execute_with_preloaded_requests,
        mock_update_swap_request_statuses,
        mock_update_section_stage,
    ):
        approved_requests = [
            {"swap_request_id": "req-1", "student_id": 44, "current_team": "team-a"},
            {"swap_request_id": "req-2", "student_id": 45, "current_team": "team-b"},
        ]
        mock_fetch_section_row.return_value = ({"id": self.section_id, "stage": "formed"}, None)
        mock_fetch_section_teams.return_value = ({"team-a": [44], "team-b": [45]}, {"team-a", "team-b"}, None)
        mock_fetch_approved_requests.return_value = (approved_requests, None)
        mock_fetch_formation_config.return_value = None
        mock_execute_with_preloaded_requests.return_value = (
            {
                "per_request_result": [
                    {"swap_request_id": "req-1", "status": "EXECUTED"},
                    {"swap_request_id": "req-2", "status": "FAILED"},
                ],
                "num_executed": 1,
                "new_team_roster": {"section_id": self.section_id, "teams": []},
                "formation_config": None,
            },
            None,
        )
        mock_update_swap_request_statuses.return_value = []
        mock_update_section_stage.return_value = ({"id": self.section_id, "stage": "confirmed"}, None)

        response = self.client.post(f"/team-swap/sections/{self.section_id}/confirm")

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["code"], 200)
        self.assertEqual(body["data"]["approved_request_count"], 2)
        self.assertEqual(body["data"]["executed_count"], 1)
        self.assertEqual(body["data"]["failed_count"], 1)

        self.assertEqual(mock_fetch_approved_requests.call_count, 1)


if __name__ == "__main__":
    unittest.main()
