from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class Student:
    student_id: int
    year: int  # e.g., 1, 2, 3 for first, second, third year
    gender: str  # e.g., "M", "F", "Other"
    gpa: Optional[float] = None
    skills: Optional[Dict[str, float]] = None  # skill_id -> proficiency level


@dataclass
class TeamMember:
    student_id: int
    team_id: str


@dataclass
class Team:
    team_id: str
    team_number: int
    section_id: str
    students: List[int]  # student_ids


@dataclass
class ApprovedSwapRequest:
    swap_request_id: str
    student_id: int
    current_team: str  # team_id they are currently in


@dataclass
class SwapConstraints:
    min_team_avg_gpa: Optional[float] = None
    require_year_diversity: Optional[bool] = False
    max_skill_imbalance: Optional[float] = None
    swap_window_days: Optional[int] = None
