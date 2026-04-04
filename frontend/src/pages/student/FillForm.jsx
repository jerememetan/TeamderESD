import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import ModuleBlock from "../../components/schematic/ModuleBlock";
import SystemTag from "../../components/schematic/SystemTag";
import { Button } from "../../components/ui/button";
import {
  fetchFormationConfig,
  resolveFormationFieldVisibility,
} from "../../services/formationConfigService";
import { fetchEnrollmentsBySectionId } from "../../services/enrollmentService";
import { submitStudentForm } from "../../services/studentFormSubmissionService";
import { fetchStudentProfile } from "../../services/studentProfileService";
import { useStudentSession } from "../../services/studentSession";
import { loadAssignmentsForStudent } from "./logic/studentDashboardLogic";
import styles from "./FillForm.module.css";

const SKILL_SCORE_LABELS = {
  0: "None",
  1: "Beginner",
  2: "Basic",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

const MBTI_OPTIONS = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISFJ",
  "ESTJ",
  "ESFJ",
  "ISTP",
  "ISFP",
  "ESTP",
  "ESFP",
];

const DEFAULT_FIELD_VISIBILITY = {
  mbtiEnabled: false,
  buddyEnabled: false,
  buddyWeight: 0,
  skillEnabled: false,
  topicEnabled: false,
};

function FillForm() {
  const { formId, studentId: routeStudentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    activeStudent,
    activeStudentRouteId,
    isLoadingStudents,
    studentLoadError,
  } = useStudentSession(routeStudentId);

  const [teamAssignments, setTeamAssignments] = useState([]);
  const [assignmentError, setAssignmentError] = useState("");
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isLoadingBuddyOptions, setIsLoadingBuddyOptions] = useState(false);
  const [formLoadError, setFormLoadError] = useState("");
  const [formationConfig, setFormationConfig] = useState(null);
  const [fieldVisibility, setFieldVisibility] = useState(DEFAULT_FIELD_VISIBILITY);
  const [buddyOptions, setBuddyOptions] = useState([]);
  const [buddyRequestStudentId, setBuddyRequestStudentId] = useState("");
  const [mbti, setMbti] = useState("");
  const [skillScores, setSkillScores] = useState({});
  const [topicRankings, setTopicRankings] = useState({});
  const [formSubmissionError, setFormSubmissionError] = useState("");

  useEffect(() => {
    if (isLoadingStudents || !activeStudent) {
      return;
    }

    loadAssignmentsForStudent(
      activeStudent,
      setTeamAssignments,
      () => {},
      () => {},
      setAssignmentError,
      setIsLoadingAssignments,
    );
  }, [activeStudent, isLoadingStudents]);

  const scopedFormIds = location.state?.availableFormIds;
  const availableForms = useMemo(
    () =>
      teamAssignments
        .filter((assignment) => Boolean(assignment?.sectionId))
        .map((assignment) => ({
          id: String(assignment.sectionId),
          sectionId: assignment.sectionId,
          title: `${assignment.courseCode || assignment.courseId || "Course"} - ${assignment.courseName || "Section"}`,
          description: "Open form entry",
          assignment,
        })),
    [teamAssignments],
  );

  const availableFormList = useMemo(() => {
    const formPool = Array.isArray(scopedFormIds) && scopedFormIds.length
      ? availableForms.filter((form) => scopedFormIds.includes(form.id))
      : availableForms;
    return formPool;
  }, [availableForms, scopedFormIds]);
  const resolvedForm = formId ? availableFormList.find((form) => form.id === formId) : availableFormList[0];
  const resolvedAssignment = resolvedForm
    ? teamAssignments.find((assignment) => String(assignment.sectionId) === String(resolvedForm.sectionId)) || null
    : null;
  const chooserMode = !formId && availableFormList.length > 1;
  const studentBasePath = `/student/${activeStudentRouteId}`;

  const resolvedAssignmentLabel = resolvedAssignment
    ? `${resolvedAssignment.courseCode || resolvedAssignment.courseId} :: ${resolvedAssignment.groupCode || resolvedAssignment.groupId}`
    : resolvedForm
      ? "Selected section"
      : "Backend form";

  const sectionSkills = Array.isArray(formationConfig?.skills) ? formationConfig.skills : [];
  const sectionTopics = Array.isArray(formationConfig?.topics) ? formationConfig.topics : [];
  const shouldCollectSkills = fieldVisibility.skillEnabled && sectionSkills.length > 0;
  const shouldCollectTopics = fieldVisibility.topicEnabled && sectionTopics.length > 0;
  const shouldCollectMbti = fieldVisibility.mbtiEnabled;
  const shouldCollectBuddy = fieldVisibility.buddyEnabled;

  useEffect(() => {
    let isMounted = true;

    async function loadSectionFormationConfig() {
      if (!resolvedForm || !activeStudent) {
        setFormationConfig(null);
        setFieldVisibility(DEFAULT_FIELD_VISIBILITY);
        setBuddyOptions([]);
        setSkillScores({});
        setTopicRankings({});
        setBuddyRequestStudentId("");
        setMbti("");
        setFormLoadError("");
        return;
      }

      const sectionId = resolvedForm.sectionId;
      const activeStudentId = Number(activeStudent.backendStudentId);

      setIsLoadingConfig(true);
      setFormLoadError("");
      setFormSubmissionError("");
      setBuddyRequestStudentId("");
      setMbti("");
      setBuddyOptions([]);

      try {
        const configResponse = await fetchFormationConfig(sectionId);
        if (!isMounted) {
          return;
        }

        const nextVisibility = resolveFormationFieldVisibility(configResponse);
        const skills = Array.isArray(configResponse?.skills) ? configResponse.skills : [];
        const topics = Array.isArray(configResponse?.topics) ? configResponse.topics : [];

        setFormationConfig(configResponse);
        setFieldVisibility(nextVisibility);
        setSkillScores(
          skills.reduce((acc, skill) => {
            if (skill?.skill_id) {
              acc[String(skill.skill_id)] = "";
            }
            return acc;
          }, {}),
        );
        setTopicRankings(
          topics.reduce((acc, topic) => {
            if (topic?.topic_id) {
              acc[String(topic.topic_id)] = "";
            }
            return acc;
          }, {}),
        );

        if (!nextVisibility.buddyEnabled) {
          return;
        }

        setIsLoadingBuddyOptions(true);
        const [enrollments, students] = await Promise.all([
          fetchEnrollmentsBySectionId(sectionId),
          fetchStudentProfile(sectionId),
        ]);

        if (!isMounted) {
          return;
        }

        const rosterIds = Array.from(
          new Set(
            (Array.isArray(enrollments) ? enrollments : [])
              .map((enrollment) => Number(enrollment?.student_id))
              .filter((studentId) => Number.isFinite(studentId) && studentId !== activeStudentId),
          ),
        );

        const studentNameById = new Map(
          (Array.isArray(students) ? students : []).map((student) => {
            const studentId = Number(student?.student_id);
            const displayName =
              String(student?.profile?.name || student?.name || "").trim() || "Unnamed student";
            return [studentId, displayName];
          }),
        );

        setBuddyOptions(
          rosterIds
            .map((studentId) => ({
              value: String(studentId),
              label: studentNameById.get(studentId) || "Unnamed student",
            }))
            .sort((left, right) => left.label.localeCompare(right.label)),
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setFormationConfig(null);
        setFieldVisibility(DEFAULT_FIELD_VISIBILITY);
        setSkillScores({});
        setTopicRankings({});
        setBuddyOptions([]);
        setFormLoadError(error?.message || "Unable to load section form configuration.");
      } finally {
        if (isMounted) {
          setIsLoadingConfig(false);
          setIsLoadingBuddyOptions(false);
        }
      }
    }

    loadSectionFormationConfig();

    return () => {
      isMounted = false;
    };
  }, [activeStudent, resolvedForm]);

  if (isLoadingStudents) {
    return (
      <div className={styles.page}>
        <p className={styles.notFound}>Loading backend student session...</p>
      </div>
    );
  }

  if (studentLoadError || !activeStudent) {
    return (
      <div className={styles.page}>
        <Link to={studentBasePath} className={styles.backLink}>
          <ArrowLeft className={styles.backIcon} /> Return to student console
        </Link>
        <p className={styles.notFound}>{studentLoadError || "Backend student data is unavailable."}</p>
      </div>
    );
  }

  if (assignmentError || formLoadError) {
    return (
      <div className={styles.page}>
        <Link to={studentBasePath} className={styles.backLink}>
          <ArrowLeft className={styles.backIcon} /> Return to student console
        </Link>
        <p className={styles.notFound}>{assignmentError || formLoadError}</p>
      </div>
    );
  }

  if (!formId && !resolvedForm && !isLoadingAssignments) {
    return (
      <div className={styles.page}>
        <Link to={studentBasePath} className={styles.backLink}>
          <ArrowLeft className={styles.backIcon} /> Return to student console
        </Link>
        <p className={styles.notFound}>No form entries are available for this student.</p>
      </div>
    );
  }

  const availableFormCount = availableFormList.length;
  const availableFormIds = availableFormList.map((form) => form.id);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormSubmissionError("");

    try {
      if (!resolvedForm || !activeStudent) {
        throw new Error("Unable to resolve form context for submission.");
      }

      const normalizedSkills = shouldCollectSkills
        ? sectionSkills
            .map((skill) => ({
              skill_id: String(skill?.skill_id || "").trim(),
              skill_level: Number(skillScores[String(skill?.skill_id)]),
            }))
            .filter((row) => row.skill_id && Number.isFinite(row.skill_level))
        : [];

      const invalidSkills = normalizedSkills.filter(
        (row) => !row.skill_id || !Number.isFinite(row.skill_level) || row.skill_level < 0 || row.skill_level > 5,
      );
      if (invalidSkills.length) {
        throw new Error("Each skill score must be a value between 0 and 5.");
      }

      const normalizedTopics = shouldCollectTopics
        ? sectionTopics.map((topic) => ({
            topic_id: String(topic?.topic_id || "").trim(),
            rank: Number(topicRankings[String(topic?.topic_id)]),
          }))
        : [];

      const invalidTopics = normalizedTopics.filter(
        (row) => !row.topic_id || !Number.isFinite(row.rank) || row.rank < 1,
      );
      if (invalidTopics.length) {
        throw new Error("Please rank every project topic from most preferred to least preferred.");
      }

      const sortedTopicRanks = normalizedTopics.map((topic) => topic.rank).sort((a, b) => a - b);
      const hasInvalidTopicOrder = sortedTopicRanks.some((rankValue, index) => rankValue !== index + 1);
      if (hasInvalidTopicOrder) {
        throw new Error("Topic ranks must be unique and contiguous starting from 1.");
      }

      const payload = {
        section_id: resolvedForm.sectionId,
        student_id: activeStudent.backendStudentId,
        ...(shouldCollectBuddy && buddyRequestStudentId ? { buddy_id: Number(buddyRequestStudentId) } : {}),
        ...(shouldCollectMbti && mbti.trim() ? { mbti: mbti.trim() } : {}),
        ...(normalizedSkills.length ? { skill_scores: normalizedSkills } : {}),
        ...(normalizedTopics.length ? { topic_rankings: normalizedTopics } : {}),
      };

      await submitStudentForm(payload);

      alert("Form submitted successfully!");
      navigate(studentBasePath);
    } catch (error) {
      setFormSubmissionError(error?.message || "Unable to submit form.");
    }
  };

  const updateSkillScore = (skillId, value) => {
    setSkillScores((current) => ({ ...current, [skillId]: value }));
  };

  const updateTopicRank = (topicId, value) => {
    setTopicRankings((current) => ({ ...current, [topicId]: value }));
  };

  if (chooserMode) {
    return (
      <div className={styles.page}>
        <Link to={studentBasePath} className={styles.backLink}>
          <ArrowLeft className={styles.backIcon} /> Return to student console
        </Link>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>[GROUP FORM]</p>
            <h2 className={styles.title}>Choose a form</h2>
            <p className={styles.subtitle}>You have more than one backend form record. Pick the section you want to complete first.</p>
          </div>
          <div className={styles.heroMeta}>
            <SystemTag tone="neutral">{availableFormCount} forms available</SystemTag>
          </div>
        </section>
        <div className={styles.chooserGrid}>
          {availableFormList.map((form, index) => {
            const assignment = teamAssignments.find((item) => item.sectionId === form.sectionId);
            return (
              <Link
                key={form.id}
                to={`/student/${activeStudentRouteId}/form/${form.id}`}
                state={{ availableFormIds }}
                className={styles.chooserCard}
              >
                <ModuleBlock
                  componentId={`MOD-FSEL-${index + 1}`}
                  eyebrow={assignment?.groupCode || "Section"}
                  title={assignment ? `${assignment.courseCode} - ${assignment.courseName}` : form.title}
                >
                  <p className={styles.chooserMeta}>{assignment?.groupLabel || "Assigned section"}</p>
                  <p className={styles.subtitle}>{form.description}</p>
                </ModuleBlock>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  if (!resolvedForm) {
    return (
      <div className={styles.page}>
        <Link to={studentBasePath} className={styles.backLink}>
          <ArrowLeft className={styles.backIcon} /> Return to student console
        </Link>
        <p className={styles.notFound}>Backend form records are not available for this route.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link to={studentBasePath} className={styles.backLink}>
        <ArrowLeft className={styles.backIcon} /> Return to student console
      </Link>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>[GROUP FORM]</p>
          <h2 className={styles.title}>{resolvedAssignmentLabel} form</h2>
          <p className={styles.subtitle}>Complete this backend form record for {activeStudent.name}.</p>
        </div>
        <div className={styles.heroMeta}>
          <SystemTag tone="success">Form open</SystemTag>
        </div>
      </section>

      {formSubmissionError ? <p className={styles.notFound}>{formSubmissionError}</p> : null}

      <form onSubmit={handleSubmit} className={styles.form}>
        {isLoadingConfig ? (
          <ModuleBlock componentId="MOD-CONFIG" eyebrow="Loading" title="Loading formation config">
            <p>Resolving section-specific form fields...</p>
          </ModuleBlock>
        ) : null}

        {shouldCollectBuddy ? (
          <ModuleBlock componentId="MOD-R1" eyebrow="Profile" title={fieldVisibility.buddyWeight < 0 ? "Preferred Avoid" : "Preferred Buddy"}>
            <p className={styles.subtitle}>Optional buddy preference for your current section enrollment list.</p>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="buddy-select">
                {fieldVisibility.buddyWeight < 0 ? "Select classmate to avoid" : "Select preferred classmate"}
              </label>
              <select
                id="buddy-select"
                value={buddyRequestStudentId}
                onChange={(event) => setBuddyRequestStudentId(event.target.value)}
                className={styles.select}
                disabled={isLoadingBuddyOptions}
              >
                <option value="">None</option>
                {buddyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {isLoadingBuddyOptions ? <p className={styles.subtitle}>Loading classmates...</p> : null}
            </div>
          </ModuleBlock>
        ) : null}

        {shouldCollectMbti ? (
          <ModuleBlock componentId="MOD-R1-MBTI" eyebrow="Profile" title="MBTI">
            <p className={styles.subtitle}>Optional personality preference for this section.</p>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="mbti-select">Personality type</label>
              <select
                id="mbti-select"
                value={mbti}
                onChange={(event) => setMbti(event.target.value)}
                className={styles.select}
              >
                <option value="">None</option>
                {MBTI_OPTIONS.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <a
                href="https://www.16personalities.com/free-personality-test"
                target="_blank"
                rel="noreferrer"
                className={styles.helpLink}
              >
                Find your type at 16Personalities
              </a>
            </div>
          </ModuleBlock>
        ) : null}

        {fieldVisibility.skillEnabled ? (
          <ModuleBlock componentId="MOD-R2" eyebrow="Skills" title="Skill Scores">
            <p className={styles.subtitle}>Rate your section skills from 0 (None) to 5 (Expert).</p>
            {shouldCollectSkills ? (
              <div className={styles.listGrid}>
                {sectionSkills.map((skill) => {
                  const skillId = String(skill?.skill_id || "");
                  if (!skillId) {
                    return null;
                  }

                  return (
                    <div key={skillId} className={styles.editorGrid}>
                      <p className={styles.fieldLabel}>{skill?.skill_label || "Skill"}</p>
                      <select
                        className={styles.select}
                        value={skillScores[skillId] ?? ""}
                        onChange={(event) => updateSkillScore(skillId, event.target.value)}
                      >
                        <option value="">No score</option>
                        {Object.entries(SKILL_SCORE_LABELS).map(([score, label]) => (
                          <option key={`${skillId}-score-${score}`} value={score}>
                            {score} - {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={styles.subtitle}>No skill labels are configured for this section yet.</p>
            )}
          </ModuleBlock>
        ) : null}

        {fieldVisibility.topicEnabled ? (
          <ModuleBlock componentId="MOD-R3" eyebrow="Topics" title="Project Topic Rankings">
            <p className={styles.subtitle}>Rank every section topic from most preferred (1) to least preferred.</p>
            {shouldCollectTopics ? (
              <div className={styles.listGrid}>
                {sectionTopics.map((topic) => {
                  const topicId = String(topic?.topic_id || "");
                  if (!topicId) {
                    return null;
                  }

                  return (
                    <div key={topicId} className={styles.editorGrid}>
                      <p className={styles.fieldLabel}>{topic?.topic_label || "Project topic"}</p>
                      <select
                        className={styles.select}
                        value={topicRankings[topicId] ?? ""}
                        onChange={(event) => updateTopicRank(topicId, event.target.value)}
                      >
                        <option value="">Select rank</option>
                        {Array.from({ length: sectionTopics.length }, (_, index) => index + 1).map((rankValue) => (
                          <option key={`${topicId}-rank-${rankValue}`} value={rankValue}>
                            {rankValue}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={styles.subtitle}>No project topics are configured for this section yet.</p>
            )}
          </ModuleBlock>
        ) : null}

        {isLoadingAssignments ? (
          <ModuleBlock componentId="MOD-LOAD" eyebrow="Loading" title="Loading assignments">
            <p>Resolving available sections for this student...</p>
          </ModuleBlock>
        ) : null}

        <div className={styles.actionRow}>
          <Button type="submit" disabled={isLoadingAssignments || isLoadingConfig || isLoadingBuddyOptions}>
            Submit form
          </Button>
          <Button type="button" onClick={() => navigate(studentBasePath)} variant="outline">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default FillForm;
