# Analytics & Dashboard Services

Two new services for Scenario 2: Instructor Views Team Dashboard.

---

## Analytics Service (Atomic)
- **Port:** 3014
- **Base URL:** `/analytics`
- **Purpose:** Pure computation service. Receives team + student data, returns metrics.

### POST /analytics

Compute per-team and section-wide analytics.

#### Input
```json
{
  "section_id": "<uuid>",
  "teams": [
    {
      "team_id": "<uuid>",
      "team_number": 1,
      "students": [
        { "student_id": 101 },
        { "student_id": 102 }
      ]
    }
  ],
  "students": [
    {
      "student_id": 101,
      "profile": {
        "name": "Alice Tan",
        "school": "SCIS",
        "year": 2,
        "gpa": 3.6,
        "gender": "F",
        "mbti": "INTJ",
        "reputation_score": 12,
        "buddy_id": 102,
        "topic_preferences": ["topic-uuid-1", "topic-uuid-2"],
        "competences": [
          { "skill_id": "skill-uuid-1", "skill_level": 3 }
        ]
      }
    }
  ],
  "skills": [
    { "skill_id": "skill-uuid-1", "skill_label": "Python", "skill_importance": 0.8 }
  ],
  "topics": [
    { "topic_id": "topic-uuid-1", "topic_label": "AI" }
  ],
  "criteria": {}
}
```

#### Response (200)
```json
{
  "code": 200,
  "data": {
    "section_id": "<uuid>",
    "team_analytics": [
      {
        "team_id": "<uuid>",
        "team_number": 1,
        "size": 3,
        "gpa": { "mean": 3.53, "min": 3.2, "max": 3.8, "std": 0.25 },
        "year_distribution": { "2": 2, "3": 1 },
        "school_distribution": { "SCIS": 2, "SOB": 1 },
        "gender_distribution": { "M": 1, "F": 2 },
        "mbti_distribution": { "INTJ": 1, "ENFP": 2 },
        "reputation": { "mean": 10.5, "min": 8, "max": 13, "std": 2.5 },
        "skill_balance": [
          {
            "skill_id": "...",
            "skill_label": "Python",
            "skill_importance": 0.8,
            "avg_level": 3.0,
            "min_level": 2,
            "max_level": 4,
            "coverage": 3
          }
        ],
        "topic_alignment": {
          "top_preference_distribution": { "topic-uuid-1": 2, "topic-uuid-2": 1 },
          "max_shared_top_preference": 2,
          "alignment_ratio": 0.6667
        },
        "buddy_satisfaction": { "requests": 1, "satisfied": 1, "rate": 1.0 }
      }
    ],
    "section_analytics": {
      "num_teams": 5,
      "team_sizes": [3, 3, 3, 3, 3],
      "gpa_fairness": {
        "team_means": [3.53, 3.48, 3.55, 3.50, 3.52],
        "std_of_means": 0.025,
        "range": 0.07
      },
      "reputation_fairness": {
        "team_means": [10.5, 11.0, 9.8, 10.2, 10.7],
        "std_of_means": 0.42,
        "range": 1.2
      },
      "year_balance_score": 0.92,
      "school_balance_score": 0.85,
      "gender_balance_score": 0.88,
      "skill_fairness": [
        {
          "skill_id": "...",
          "skill_label": "Python",
          "team_avg_levels": [3.0, 2.8, 3.2, 2.9, 3.1],
          "std_across_teams": 0.15
        }
      ],
      "buddy_satisfaction_overall": {
        "total_requests": 8,
        "total_satisfied": 5,
        "rate": 0.625
      }
    }
  }
}
```

### GET /analytics/health
Returns `{"status": "ok", "service": "analytics-service"}`

---

## Dashboard Orchestrator (Composite)
- **Port:** 4003
- **Base URL:** `/dashboard`
- **Purpose:** Orchestrates data gathering and analytics computation.

### GET /dashboard?section_id={uuid}

Fetches team, student, criteria, skill, and topic data from upstream services,
then POSTs to Analytics Service and returns the result.

#### Upstream calls:
1. `GET /team?section_id=...` (Team Service, port 3007)
2. `GET /student-profile?section_id=...` (Student Profile, port 4001)
3. `GET /criteria?section_id=...` (Criteria Service, port 3004)
4. `GET /skill?section_id=...` (Skill Service, port 3002)
5. `GET /topic?section_id=...` (Topic Service, port 3003)
6. `POST /analytics` (Analytics Service, port 3014)

#### Response
Passes through the Analytics Service response directly.

#### Error responses
- `400` — missing section_id
- `502` — upstream service failure

### GET /dashboard/health
Returns `{"status": "ok", "service": "dashboard-orchestrator-service"}`

---

## Docker Compose

Add the following to `backend/docker-compose.yml`:

```yaml
  analytics-service:
    build:
      context: ./atomic-services/analytics
    container_name: teamder-analytics-service
    environment:
      PORT: 3014
    ports:
      - "3014:3014"

  dashboard-orchestrator-service:
    build:
      context: ./composite-services/dashboard-orchestrator
    container_name: teamder-dashboard-orchestrator-service
    ports:
      - "4003:4003"
    environment:
      TEAM_URL: "http://team-service:3007/team"
      STUDENT_PROFILE_URL: "http://student-profile-service:4001/student-profile"
      CRITERIA_URL: "http://criteria-service:3004/criteria"
      SKILL_URL: "http://skill-service:3002/skill"
      TOPIC_URL: "http://topic-service:3003/topic"
      ANALYTICS_URL: "http://analytics-service:3014/analytics"
      REQUEST_TIMEOUT: 8
      PORT: 4003
    depends_on:
      - team-service
      - student-profile-service
      - criteria-service
      - skill-service
      - topic-service
      - analytics-service
```
