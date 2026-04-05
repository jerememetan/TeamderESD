import unittest
from pathlib import Path
import sys

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.append(str(CURRENT_DIR))

from solver import solve_teams


class TeamFormationNullHandlingTests(unittest.TestCase):
    def test_solver_handles_students_with_all_optional_fields_missing(self):
        formation_config = {
            "section_id": "sec-null-1",
            "criteria": {
                "num_groups": 1,
                "topic_weight": 1,
                "reputation_weight": 1,
            },
            "topics": [
                {"topic_id": "t1", "topic_label": "Topic 1"},
                {"topic_id": "t2", "topic_label": "Topic 2"},
            ],
            "skills": [],
        }
        student_profile = {
            "data": {
                "section_id": "sec-null-1",
                "students": [
                    {
                        "student_id": 1,
                        "profile": {
                            "buddy_id": None,
                            "mbti": None,
                            "reputation_score": None,
                            "topic_preferences": None,
                            "competences": None,
                        },
                    },
                    {
                        "student_id": 2,
                        "profile": {
                            "buddy_id": None,
                            "mbti": None,
                            "reputation_score": None,
                            "topic_preferences": None,
                            "competences": None,
                        },
                    },
                ],
            }
        }

        result = solve_teams(formation_config=formation_config, student_profile=student_profile)

        self.assertIn(result["status"], {"OPTIMAL", "FEASIBLE"})
        warnings_text = " ".join(result["diagnostics"]["warnings"]).lower()
        self.assertIn("topics criterion was skipped", warnings_text)
        self.assertIn("reputation criterion was skipped", warnings_text)

    def test_solver_handles_missing_competences_with_skill_config(self):
        formation_config = {
            "section_id": "sec-null-2",
            "criteria": {
                "num_groups": 1,
                "skill_weight": 1,
            },
            "topics": [],
            "skills": [
                {"skill_id": "python", "skill_label": "Python", "skill_importance": 1.0},
            ],
        }
        student_profile = {
            "data": {
                "section_id": "sec-null-2",
                "students": [
                    {"student_id": 1, "profile": {"competences": None}},
                    {"student_id": 2, "profile": {"competences": None}},
                ],
            }
        }

        result = solve_teams(formation_config=formation_config, student_profile=student_profile)

        self.assertIn(result["status"], {"OPTIMAL", "FEASIBLE"})
        warnings_text = " ".join(result["diagnostics"]["warnings"]).lower()
        self.assertIn("no valid skills available", warnings_text)


if __name__ == "__main__":
    unittest.main()
