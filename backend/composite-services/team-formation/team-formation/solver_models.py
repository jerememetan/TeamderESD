from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

Pair = Tuple[int, int]


@dataclass(frozen=True)
class StudentRecord:
    student_id: int
    buddy_id: Optional[int]
    gender: Optional[str]
    gpa: Optional[float]
    mbti: Optional[str]
    reputation: Optional[float]
    school: Optional[str]
    year: Optional[int]
    competences: Dict[str, float]
    topic_ranks: Dict[str, int]


@dataclass(frozen=True)
class SolverConfig:
    section_id: Optional[str]
    num_groups: int
    weights: Dict[str, float]
    weight_ints: Dict[str, int]
    randomness: float
    randomness_int: int
    search_workers: int
    phase2_ratio: float
    max_time_s: Optional[float]


@dataclass
class PreparedData:
    section_id: Optional[str]
    num_groups: int
    students: List[StudentRecord]
    skills: List[Dict[str, Any]]
    topics: List[Dict[str, Any]]
    buddy_pairs: Dict[Pair, int]
    diagnostics: Dict[str, List[str]]
