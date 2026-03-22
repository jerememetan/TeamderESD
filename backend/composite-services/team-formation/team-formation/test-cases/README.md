# Team Formation Manual Test Cases

Use this student dataset for all configs:

- `student-profile-30.json`

Each config isolates one behavior in a simple way.

## Run Command

Run from `c:\ESD\Teamder`:

```powershell
py -3 backend/composite-services/team-formation/team-formation/solver.py `
  --formation-config <CONFIG_PATH> `
  --student-profile backend/composite-services/team-formation/team-formation/test-cases/student-profile-30.json `
  --time-limit-s 8
```

## Config Cases

1. `config-01-all-balanced.json`
   - All main criteria active with randomness disabled (deterministic baseline).

2. `config-02-buddy-positive.json`
   - Positive buddy weight only.

3. `config-03-buddy-negative.json`
   - Negative buddy weight only.

4. `config-04-diversity-positive.json`
   - Positive diversity criteria only (`gender/school/year/gpa/reputation/mbti`).

5. `config-05-similarity-negative.json`
   - Negative diversity criteria only (encourages similar grouping).

6. `config-06-skills-balanced.json`
   - Positive skill weight only (balanced skills).

7. `config-07-skills-unbalanced.json`
   - Negative skill weight only (unbalanced skills).

8. `config-08-topics-similar.json`
   - Positive topic weight only (similar topic preferences).

9. `config-09-topics-opposite.json`
   - Negative topic weight only (opposite preferences).

10. `config-10-randomness-only.json`
    - Only randomness active; useful for seed tests.

11. `config-11-mixed-high-randomness.json`
    - Mixed criteria with medium-high randomness.

## Quick Seed Check (randomness-focused)

```powershell
py -3 backend/composite-services/team-formation/team-formation/solver.py --formation-config backend/composite-services/team-formation/team-formation/test-cases/config-10-randomness-only.json --student-profile backend/composite-services/team-formation/team-formation/test-cases/student-profile-30.json --seed 123 --time-limit-s 8
py -3 backend/composite-services/team-formation/team-formation/solver.py --formation-config backend/composite-services/team-formation/team-formation/test-cases/config-10-randomness-only.json --student-profile backend/composite-services/team-formation/team-formation/test-cases/student-profile-30.json --seed 321 --time-limit-s 8
```
