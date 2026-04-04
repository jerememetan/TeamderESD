import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import ModuleBlock from "../../../components/schematic/ModuleBlock";
import SystemTag from "../../../components/schematic/SystemTag";
import { Button } from "../../../components/ui/button";
import { submitStudentForm } from "../../../services/studentFormSubmissionService";
import { useStudentSession } from "../../../services/studentSession";
import { useFillFormPage } from "./logic/useFillFormPage";
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

function FillForm() {
  const { formId, studentId: routeStudentId } = useParams();
  const navigate = useNavigate();
  const {
    activeStudent,
    activeStudentRouteId,
    isLoadingStudents,
    studentLoadError,
  } = useStudentSession(routeStudentId);
  const {
    formsError,
    isLoadingForms,
    isLoadingConfig,
    isLoadingBuddyOptions,
    formLoadError,
    fieldVisibility,
    buddyOptions,
    buddyRequestStudentId,
    setBuddyRequestStudentId,
    mbti,
    setMbti,
    skillScores,
    topicRankings,
    formSubmissionError,
    setFormSubmissionError,
    availableFormList,
    availableFormCount,
    resolvedForm,
    chooserMode,
    studentBasePath,
    resolvedAssignmentLabel,
    sectionSkills,
    sectionTopics,
    shouldCollectSkills,
    shouldCollectTopics,
    shouldCollectMbti,
    shouldCollectBuddy,
    updateSkillScore,
    updateTopicRank,
  } = useFillFormPage({
    formId,
    activeStudent,
    activeStudentRouteId,
    isLoadingStudents,
    navigate,
  });

  if (isLoadingStudents) {
    return (
      <div className={styles.page}>
        <p className={styles.notFound}>Loading student session...</p>
      </div>
    );
  }

  if (studentLoadError || !activeStudent) {
    return (
      <div className={styles.page}>
        <Link to={studentBasePath} className={styles.backLink}>
          <ArrowLeft className={styles.backIcon} /> Return to student console
        </Link>
        <p className={styles.notFound}>
          {studentLoadError || "Student data is unavailable."}
        </p>
      </div>
    );
  }

  if (formsError || formLoadError) {
    return (
      <div className={styles.page}>
        <Link to={studentBasePath} className={styles.backLink}>
          <ArrowLeft className={styles.backIcon} /> Return to student console
        </Link>
        <p className={styles.notFound}>{formsError || formLoadError}</p>
      </div>
    );
  }

  if (!formId && isLoadingForms) {
    return (
      <div className={styles.page}>
        <Link to={studentBasePath} className={styles.backLink}>
          <ArrowLeft className={styles.backIcon} /> Return to student console
        </Link>
        <ModuleBlock eyebrow="Loading" title="Loading forms">
          <p>Fetching your available forms from student-form service...</p>
        </ModuleBlock>
      </div>
    );
  }

  if (!formId && !availableFormList.length && !isLoadingForms) {
    return (
      <div className={styles.page}>
        <Link to={studentBasePath} className={styles.backLink}>
          <ArrowLeft className={styles.backIcon} /> Return to student console
        </Link>
        <p className={styles.notFound}>
          No unsubmitted form entries are available for this student.
        </p>
      </div>
    );
  }

  if (formId && isLoadingForms) {
    return (
      <div className={styles.page}>
        <Link to={studentBasePath} className={styles.backLink}>
          <ArrowLeft className={styles.backIcon} /> Return to student console
        </Link>
        <ModuleBlock
          componentId="MOD-FLOAD-DETAIL"
          eyebrow="Loading"
          title="Loading form"
        >
          <p>Resolving this form record for the selected student...</p>
        </ModuleBlock>
      </div>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormSubmissionError("");

    try {
      if (!resolvedForm || !activeStudent) {
        throw new Error("Unable to resolve form context for submission.");
      }

      const resolvedSectionId = String(resolvedForm.sectionId || "").trim();
      if (!resolvedSectionId) {
        throw new Error(
          "Unable to resolve section_id for this form submission.",
        );
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
        (row) =>
          !row.skill_id ||
          !Number.isFinite(row.skill_level) ||
          row.skill_level < 0 ||
          row.skill_level > 5,
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
        throw new Error(
          "Please rank every project topic from most preferred to least preferred.",
        );
      }

      const sortedTopicRanks = normalizedTopics
        .map((topic) => topic.rank)
        .sort((a, b) => a - b);
      const hasInvalidTopicOrder = sortedTopicRanks.some(
        (rankValue, index) => rankValue !== index + 1,
      );
      if (hasInvalidTopicOrder) {
        throw new Error(
          "Topic ranks must be unique and contiguous starting from 1.",
        );
      }

      const payload = {
        section_id: resolvedSectionId,
        student_id: activeStudent.backendStudentId,
        ...(shouldCollectBuddy && buddyRequestStudentId
          ? { buddy_id: Number(buddyRequestStudentId) }
          : {}),
        ...(shouldCollectMbti && mbti.trim() ? { mbti: mbti.trim() } : {}),
        ...(normalizedSkills.length ? { skill_scores: normalizedSkills } : {}),
        ...(normalizedTopics.length
          ? { topic_rankings: normalizedTopics }
          : {}),
      };

      await submitStudentForm(payload);

      alert("Form submitted successfully!");
      navigate(studentBasePath);
    } catch (error) {
      setFormSubmissionError(error?.message || "Unable to submit form.");
    }
  };

  if (chooserMode) {
    return (
      <div className={styles.page}>
        <Link to={studentBasePath} className={styles.backLink}>
          <ArrowLeft className={styles.backIcon} /> Return to student console
        </Link>
        <section className={styles.hero}>
          <div>
            <h2 className={styles.title}>Choose a form</h2>
            <p className={styles.subtitle}>Available forms</p>
          </div>
          <div className={styles.heroMeta}>
            <SystemTag tone="neutral">
              {availableFormCount} forms available
            </SystemTag>
          </div>
        </section>
        <div className={styles.chooserGrid}>
          {availableFormList.map((form) => {
            return (
              <Link
                key={form.id}
                to={`/student/${activeStudentRouteId}/form/${form.id}`}
                className={styles.chooserCard}
              >
                <ModuleBlock eyebrow="Course" title={form.title}>
                  <p className={styles.chooserMeta}>{form.description}</p>
                  <p className={styles.subtitle}>Open form entry</p>
                </ModuleBlock>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  if (resolvedForm?.submitted) {
    return (
      <div className={styles.page}>
        <Link to={studentBasePath} className={styles.backLink}>
          <ArrowLeft className={styles.backIcon} /> Return to student console
        </Link>
        <ModuleBlock
          componentId="MOD-FSUB"
          eyebrow="Submitted"
          title="Form already submitted"
        >
          <p className={styles.subtitle}>
            This form has already been submitted. Redirecting you back to your
            dashboard...
          </p>
          <div className={styles.actionRow}>
            <Button type="button" onClick={() => navigate(studentBasePath)}>
              Return to dashboard
            </Button>
          </div>
        </ModuleBlock>
      </div>
    );
  }

  if (!resolvedForm) {
    return (
      <div className={styles.page}>
        <Link to={studentBasePath} className={styles.backLink}>
          <ArrowLeft className={styles.backIcon} /> Return to student console
        </Link>
        <p className={styles.notFound}>
          Form records are not available for this route.
        </p>
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
          <h2 className={styles.title}>{resolvedAssignmentLabel} form</h2>
          <p className={styles.subtitle}>Logged In As: {activeStudent.name}.</p>
        </div>
        <div className={styles.heroMeta}>
          <SystemTag tone="success">Form open</SystemTag>
        </div>
      </section>

      {formSubmissionError ? (
        <p className={styles.notFound}>{formSubmissionError}</p>
      ) : null}

      <form onSubmit={handleSubmit} className={styles.form}>
        {isLoadingConfig ? (
          <ModuleBlock
            componentId="MOD-CONFIG"
            eyebrow="Loading"
            title="Loading formation config"
          >
            <p>Resolving section-specific form fields...</p>
          </ModuleBlock>
        ) : null}

        {shouldCollectBuddy ? (
          <ModuleBlock
            eyebrow="Profile"
            title={
              fieldVisibility.buddyWeight < 0
                ? "Preferred Avoid"
                : "Preferred Buddy"
            }
          >
            <p className={styles.subtitle}>
              Optional buddy preference for your current section enrollment
              list.
            </p>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="buddy-select">
                {fieldVisibility.buddyWeight < 0
                  ? "Select classmate to avoid"
                  : "Select preferred classmate"}
              </label>
              <select
                id="buddy-select"
                value={buddyRequestStudentId}
                onChange={(event) =>
                  setBuddyRequestStudentId(event.target.value)
                }
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
              {isLoadingBuddyOptions ? (
                <p className={styles.subtitle}>Loading classmates...</p>
              ) : null}
            </div>
          </ModuleBlock>
        ) : null}

        {shouldCollectMbti ? (
          <ModuleBlock eyebrow="Profile" title="MBTI">
            <p className={styles.subtitle}>
              Optional personality preference for this section.
            </p>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="mbti-select">
                Personality type
              </label>
              <select
                id="mbti-select"
                value={mbti}
                onChange={(event) => setMbti(event.target.value)}
                className={styles.select}
              >
                <option value="">None</option>
                {MBTI_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
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
          <ModuleBlock eyebrow="Skills" title="Skill Scores">
            <p className={styles.subtitle}>
              Rate your section skills from 0 (None) to 5 (Expert).
            </p>
            {shouldCollectSkills ? (
              <div className={styles.listGrid}>
                {sectionSkills.map((skill) => {
                  const skillId = String(skill?.skill_id || "");
                  if (!skillId) {
                    return null;
                  }

                  return (
                    <div key={skillId} className={styles.editorGrid}>
                      <p className={styles.fieldLabel}>
                        {skill?.skill_label || "Skill"}
                      </p>
                      <select
                        className={styles.select}
                        value={skillScores[skillId] ?? ""}
                        onChange={(event) =>
                          updateSkillScore(skillId, event.target.value)
                        }
                      >
                        <option value="">No score</option>
                        {Object.entries(SKILL_SCORE_LABELS).map(
                          ([score, label]) => (
                            <option
                              key={`${skillId}-score-${score}`}
                              value={score}
                            >
                              {score} - {label}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={styles.subtitle}>
                No skill labels are configured for this section yet.
              </p>
            )}
          </ModuleBlock>
        ) : null}

        {fieldVisibility.topicEnabled ? (
          <ModuleBlock eyebrow="Topics" title="Project Topic Rankings">
            <p className={styles.subtitle}>
              Rank every section topic from most preferred (1) to least
              preferred.
            </p>
            {shouldCollectTopics ? (
              <div className={styles.listGrid}>
                {sectionTopics.map((topic) => {
                  const topicId = String(topic?.topic_id || "");
                  if (!topicId) {
                    return null;
                  }

                  return (
                    <div key={topicId} className={styles.editorGrid}>
                      <p className={styles.fieldLabel}>
                        {topic?.topic_label || "Project topic"}
                      </p>
                      <select
                        className={styles.select}
                        value={topicRankings[topicId] ?? ""}
                        onChange={(event) =>
                          updateTopicRank(topicId, event.target.value)
                        }
                      >
                        <option value="">Select rank</option>
                        {Array.from(
                          { length: sectionTopics.length },
                          (_, index) => index + 1,
                        ).map((rankValue) => (
                          <option
                            key={`${topicId}-rank-${rankValue}`}
                            value={rankValue}
                          >
                            {rankValue}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={styles.subtitle}>
                No project topics are configured for this section yet.
              </p>
            )}
          </ModuleBlock>
        ) : null}

        {isLoadingForms ? (
          <ModuleBlock eyebrow="Loading" title="Loading forms">
            <p>Fetching forms for the selected student...</p>
          </ModuleBlock>
        ) : null}

        <div className={styles.actionRow}>
          <Button
            type="submit"
            disabled={
              isLoadingForms || isLoadingConfig || isLoadingBuddyOptions
            }
          >
            Submit form
          </Button>
          <Button
            type="button"
            onClick={() => navigate(studentBasePath)}
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default FillForm;
