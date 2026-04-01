# Team Formation Composite Service (CP-SAT Implementation Guide)

This document explains how the `team-formation` composite microservice forms teams using OR-Tools CP-SAT, how each criterion is modeled, and what to watch out for in performance and configuration.

---

## 1. What This Service Does

Runtime flow:

1. `POST /team-formation` receives request body with `section_id`.
2. Fetches student profile data from `student-profile` composite service.
3. Fetches criteria/topics/skills from `formation-config` composite service.
4. Runs CP-SAT model to assign each student to exactly one team.
5. Transforms solver output and persists teams into team atomic service via `POST /team`.
6. Returns the response from team atomic service.

Health endpoint:

- `GET /health`

Main route implementation:

- `team-formation/app.py`

---

## 2. Code Structure

```text
team-formation/
  Dockerfile
  requirements.txt
  team-formation/
    app.py
    solver.py
    config_interpreter.py
    data_preparation.py
    objective_builder.py
    randomness_engine.py
    solver_models.py
    test_app.py
    test-cases/
```

Responsibilities:

- `app.py`: API orchestration and inter-service REST calls.
- `config_interpreter.py`: parses criteria config and scales numeric weights to integer objective coefficients.
- `data_preparation.py`: normalizes/validates students, topics, skills, buddy pairs.
- `objective_builder.py`: deterministic constraints/objective for criteria.
- `randomness_engine.py`: randomness objective terms.
- `solver.py`: two-phase solve logic, scoring, diagnostics, result formatting.

---

## 3. CP-SAT Model Basics

Core decision variables:

- `x[s,g]` (bool): student `s` assigned to group `g`.
- `team_size[g]` (int): number of students in group `g`, bounded so sizes differ by at most 1.

Hard constraints:

- Every student is in exactly one team.
- Every team size equals the sum of assigned students.
- Symmetry-breaking constraints reduce equivalent label permutations:
  - Team sizes are ordered.
  - For equal-size teams, a deterministic signature ordering is enforced.

Why symmetry-breaking matters:

- It prunes equivalent solutions (same partition, different team labels), usually reducing solve time.

---

## 4. Input Parsing and Validation

`config_interpreter.parse_solver_config(...)`:

- Reads criteria weights:
  - `buddy_weight`, `gender_weight`, `gpa_weight`, `mbti_weight`, `reputation_weight`, `school_weight`, `skill_weight`, `topic_weight`, `year_weight`
- Reads runtime knobs:
  - `randomness` (clamped to `[0,1]`)
  - `search_workers` (clamped to `[1,64]`)
  - `phase2_ratio` (clamped to `[0,0.95]`)
  - `max_time_s` (ignored if <= 0)
- Converts floating weights to integer coefficients for CP-SAT objective stability.

`data_preparation.prepare_data(...)`:

- Validates section consistency between formation config and student profile.
- Parses each student and normalizes fields (`gpa`, `year`, `mbti`, reputation, competences, topic preferences).
- Builds buddy pair graph (by student index pairs).
- Filters topics and skills to usable entries.
- Emits `diagnostics.errors` and `diagnostics.warnings`.

If `diagnostics.errors` is non-empty, solver exits early with `INVALID_INPUT`.

---

## 5. Criterion Modeling (How Each Criterion Is Handled)

All deterministic criteria are built in `objective_builder.build_deterministic_objective(...)`.

### 5.1 Buddy (`buddy_weight`)

Goal: place buddy-linked students in the same team.

How:

- For each buddy pair `(i,j)`, a boolean `same_var` is created.
- `same_var` is true if both students are assigned to the same group.
- Pair weights are normalized into integer coefficients.
- Objective adds positive reward for `same_var = 1`.

Effect:

- Higher `buddy_weight` increases preference for buddy co-assignment.

---

### 5.2 Gender / School / Year Diversity

Goal: spread categories across teams instead of concentrating one category in one team.

How:

- For each team and category, count category members.
- Penalize absolute deviation from ideal proportional split:
  - `|K * count(team,category) - team_size|`
  - `K` = number of categories.
- Objective subtracts weighted deviation.

Effect:

- Encourages balanced representation per team.

---

### 5.3 GPA / Reputation Diversity (Bucket-Based)

Goal: diversify numeric traits across teams.

How:

- Numeric values are bucketed (up to 3 buckets).
- Same deviation penalty framework as categorical diversity.

Notes:

- Missing values are skipped.
- If not enough variation exists, criterion naturally weakens or becomes no-op.

---

### 5.4 MBTI Diversity

Goal: avoid one-sided MBTI composition by balancing each dichotomy.

How:

- Four dichotomies are modeled: `I/E`, `N/S`, `T/F`, `J/P`.
- For each team and each dichotomy:
  - Compute `count(left_letter)` and penalize `|2*count_left - team_size|`.
- Objective subtracts weighted total imbalance.

Effect:

- Encourages balanced cognitive/personality composition.

---

### 5.5 Topic Concentration (`topic_weight`)

Goal (as implemented): maximize within-team concentration on a strong shared topic preference signal.

How:

- Student ranked preferences are converted to points (higher rank => higher points).
- For each team:
  - Compute per-topic team score.
  - Compute `max_topic_score` and total topic score.
  - Concentration variable: `active_topic_count * max_topic_score - total_topic_score`.
- Objective rewards higher concentration.

Important:

- This criterion is not diversity; it intentionally rewards topic alignment concentration.
- If topic vectors are uniform or there is <=1 active topic, criterion is skipped and warning is recorded.

---

### 5.6 Skills Balance (`skill_weight`)

Goal: distribute skills so each team gets balanced competence coverage relative to section totals.

How:

- For each `(team, skill)`:
  - Compute team skill sum.
  - Penalize `|num_groups * team_skill_sum - total_skill_sum|`.
- Penalty is weighted by `skill_importance`.
- Objective subtracts weighted imbalance.

Simplifications and warnings:

- Skills with all-zero values are skipped.
- Skills with no variance across students are skipped.
- Unknown skill IDs (not found in student competences) are skipped.

---

### 5.7 Randomness (`randomness`)

Goal: inject controlled nondeterministic variety in final assignments.

How:

- Builds random jitter coefficients over assignment variables `x[s,g]` (seeded by section ID or explicit seed).
- Randomness objective is independent from deterministic criteria.
- Active in phase 2 (or single-phase randomness-only mode).

Effect:

- Higher randomness allows more exploration among near-equivalent deterministic solutions.

---

## 6. Two-Phase Solve Strategy

Implemented in `solver.solve_teams(...)`.

### Phase 1: Deterministic solve

- Maximize deterministic objective only.
- Stores best deterministic score and assignment hint.

### Phase 2: Randomness within quality frontier

Triggered when deterministic criteria and randomness are both active.

- Compute allowed deterministic drop with `compute_quality_frontier_drop(...)`.
- Add quality-floor constraint:
  - `deterministic_score >= phase1_best - allowed_drop`
- Add phase-1 assignment hints.
- Optimize combined objective:
  - `tie_multiplier * randomness_expr + deterministic_expr`

Fallback behavior:

- If phase 2 does not find feasible/optimal solution, service falls back to phase 1 solution and emits warning in diagnostics.

Time budget split:

- `phase2_ratio` controls how much time is reserved for phase 2.

---

## 7. Diagnostics and Status

Success statuses:

- `OPTIMAL`
- `FEASIBLE`

Failure/invalid statuses:

- `INVALID_INPUT`
- `INFEASIBLE`
- `MODEL_INVALID`
- `UNKNOWN`

Debug payload (`X-Debug-Mode`) includes:

- status
- objective breakdown (`total_score`, per-criterion scores)
- solver stats (`wall_time_s`, conflicts, branches, bounds, workers)
- diagnostics (warnings/errors, seed, phase scores, timing split, randomness stats)

---

## 8. Performance Warnings and Tuning

### High randomness can significantly slow down formation

Why:

- Randomness activates phase 2 search across more near-optimal regions.
- Higher randomness generally permits a larger quality frontier drop, which broadens search.

Mitigations:

- Lower `criteria.randomness`.
- Lower `criteria.phase2_ratio` to allocate less time to phase 2.
- Set reasonable `criteria.max_time_s`.

---

### Large cohorts and many groups increase model size quickly

Why:

- Assignment vars scale with `students * groups`.
- Buddy pair modeling and per-criterion helper vars add substantial overhead.

Mitigations:

- Keep `num_groups` realistic.
- Reduce non-critical criterion weights to zero for faster experiments.

---

### Topics and skills can add many auxiliary variables

Why:

- Topics create per-team per-topic score variables plus concentration vars.
- Skills create per-team per-skill sum/deviation variables.

Mitigations:

- Keep only informative topics/skills.
- Remove low-quality or constant features.

---

### Search worker count is not monotonic

Why:

- More workers can help, but high parallelism may add overhead or non-deterministic runtime behavior.

Mitigations:

- Tune `search_workers` for deployment hardware.
- Start with moderate values (for example 4-8 on common servers).

---

## 9. Environment Variables

- `PORT` (default `4002`)
- `REQUEST_TIMEOUT` (default `8`)
- `STUDENT_PROFILE_URL` (default `http://localhost:4001/student-profile`)
- `FORMATION_CONFIG_URL` (default `http://localhost:4000/formation-config`)
- `TEAM_URL` (default `http://localhost:3007/team`)
- `SOLVER_TIME_LIMIT_S` (default `10`)
- `TEAM_FORMATION_SEARCH_WORKERS` (fallback default if not supplied by criteria payload)
- `LOG_LEVEL` (default `INFO`)

---

## 10. REST Contracts (Team Formation Service)

### POST /team-formation

Request body:

```json
{
  "section_id": "<uuid>"
}
```

Behavior:

- Solves and persists teams into atomic team service.
- Returns team service response directly.

Common failures:

- `400` missing `section_id` in request body.
- `502` fetch failure from upstream composites.
- `502` persist failure to team atomic service.
- `422` infeasible/invalid formation.

### GET /health

- Returns basic service status.

