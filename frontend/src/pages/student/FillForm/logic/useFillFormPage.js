import { useEffect, useMemo, useState } from "react";
import {
  fetchFormationConfig,
  resolveFormationFieldVisibility,
} from "../../../../services/formationConfigService";
import { fetchEnrollmentsBySectionId } from "../../../../services/enrollmentService";
import { fetchAllCourses } from "../../../../services/courseService";
import { fetchAllSections } from "../../../../services/sectionService";
import { fetchStudentForms } from "../../../../services/studentFormService";
import {
  buildStudentMapByBackendId,
  fetchAllStudents,
} from "../../../../services/studentService";

const DEFAULT_FIELD_VISIBILITY = {
  mbtiEnabled: false,
  buddyEnabled: false,
  buddyWeight: 0,
  skillEnabled: false,
  topicEnabled: false,
};

export function useFillFormPage({
  formId,
  activeStudent,
  activeStudentRouteId,
  isLoadingStudents,
  navigate,
}) {
  const [availableForms, setAvailableForms] = useState([]);
  const [formsError, setFormsError] = useState("");
  const [isLoadingForms, setIsLoadingForms] = useState(true);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isLoadingBuddyOptions, setIsLoadingBuddyOptions] = useState(false);
  const [formLoadError, setFormLoadError] = useState("");
  const [formationConfig, setFormationConfig] = useState(null);
  const [fieldVisibility, setFieldVisibility] = useState(
    DEFAULT_FIELD_VISIBILITY,
  );
  const [buddyOptions, setBuddyOptions] = useState([]);
  const [buddyRequestStudentId, setBuddyRequestStudentId] = useState("");
  const [mbti, setMbti] = useState("");
  const [skillScores, setSkillScores] = useState({});
  const [topicRankings, setTopicRankings] = useState({});
  const [formSubmissionError, setFormSubmissionError] = useState("");

  useEffect(() => {
    if (isLoadingStudents || !activeStudent) {
      setAvailableForms([]);
      setIsLoadingForms(isLoadingStudents);
      return;
    }

    let ignore = false;

    async function loadForms() {
      setIsLoadingForms(true);
      setFormsError("");

      try {
        const backendStudentId = Number(activeStudent.backendStudentId);
        if (!Number.isFinite(backendStudentId)) {
          throw new Error(
            "Unable to resolve a backend student id for the selected student.",
          );
        }

        const [forms, sections, courses] = await Promise.all([
          fetchStudentForms({ studentId: backendStudentId }),
          fetchAllSections(),
          fetchAllCourses(),
        ]);
        if (ignore) {
          return;
        }

        const sectionById = new Map(
          (Array.isArray(sections) ? sections : []).map((section) => [
            String(section?.id ?? ""),
            section,
          ]),
        );

        const courseById = new Map(
          (Array.isArray(courses) ? courses : []).map((course) => [
            String(course?.id ?? course?.course_id ?? ""),
            {
              code: String(course?.code ?? course?.course_code ?? "").trim(),
              name: String(course?.name ?? course?.course_name ?? "").trim(),
            },
          ]),
        );

        setAvailableForms(
          forms.map((form, index) => ({
            id: String(form.id),
            sectionId: String(form.sectionId || "").trim(),
            submitted: Boolean(form.submitted),
            title: (() => {
              const sectionRecord = sectionById.get(String(form.sectionId));
              const sectionNumber = Number(sectionRecord?.section_number);
              const courseId = String(sectionRecord?.course_id ?? "");
              const course = courseById.get(courseId);
              const courseCode = String(course?.code || "").trim();

              if (courseCode && Number.isFinite(sectionNumber)) {
                return `${courseCode} G${sectionNumber}`;
              }

              if (courseCode) {
                return courseCode;
              }

              return Number.isFinite(sectionNumber)
                ? `Section ${sectionNumber}`
                : `Form ${index + 1}`;
            })(),
            description: (() => {
              const sectionRecord = sectionById.get(String(form.sectionId));
              const courseId = String(sectionRecord?.course_id ?? "");
              const course = courseById.get(courseId);
              return String(course?.name || "").trim() || "Course form";
            })(),
          })),
        );
      } catch (error) {
        if (ignore) {
          return;
        }
        setAvailableForms([]);
        setFormsError(
          error?.message || "Unable to load forms for this student.",
        );
      } finally {
        if (!ignore) {
          setIsLoadingForms(false);
        }
      }
    }

    loadForms();

    return () => {
      ignore = true;
    };
  }, [activeStudent, isLoadingStudents]);

  const availableFormList = useMemo(
    () => availableForms.filter((form) => !form.submitted),
    [availableForms],
  );
  const resolvedForm = formId
    ? availableForms.find((form) => form.id === formId)
    : null;
  const chooserMode = !formId;
  const studentBasePath = `/student/${activeStudentRouteId}`;

  const resolvedAssignmentLabel = resolvedForm?.title || "Course form";

  const sectionSkills = Array.isArray(formationConfig?.skills)
    ? formationConfig.skills
    : [];
  const sectionTopics = Array.isArray(formationConfig?.topics)
    ? formationConfig.topics
    : [];
  const shouldCollectSkills =
    fieldVisibility.skillEnabled && sectionSkills.length > 0;
  const shouldCollectTopics =
    fieldVisibility.topicEnabled && sectionTopics.length > 0;
  const shouldCollectMbti = fieldVisibility.mbtiEnabled;
  const shouldCollectBuddy = fieldVisibility.buddyEnabled;

  useEffect(() => {
    if (!formId || isLoadingForms || !resolvedForm?.submitted) {
      return;
    }

    const redirectHandle = window.setTimeout(() => {
      navigate(studentBasePath);
    }, 2500);

    return () => {
      window.clearTimeout(redirectHandle);
    };
  }, [
    formId,
    isLoadingForms,
    navigate,
    resolvedForm?.submitted,
    studentBasePath,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function loadSectionFormationConfig() {
      if (!resolvedForm || !activeStudent || resolvedForm.submitted) {
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
        const matchingForms = await fetchStudentForms({
          studentId: activeStudentId,
          sectionId,
        });
        const effectiveSectionId = matchingForms[0]?.sectionId || sectionId;

        if (!effectiveSectionId) {
          throw new Error(
            "Unable to resolve a valid section for this student form.",
          );
        }

        const configResponse = await fetchFormationConfig(effectiveSectionId);
        if (!isMounted) {
          return;
        }

        const nextVisibility = resolveFormationFieldVisibility(configResponse);
        const skills = Array.isArray(configResponse?.skills)
          ? configResponse.skills
          : [];
        const topics = Array.isArray(configResponse?.topics)
          ? configResponse.topics
          : [];

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
          fetchEnrollmentsBySectionId(effectiveSectionId),
          fetchAllStudents(),
        ]);

        if (!isMounted) {
          return;
        }

        const rosterIds = Array.from(
          new Set(
            (Array.isArray(enrollments) ? enrollments : [])
              .map((enrollment) => Number(enrollment?.student_id))
              .filter(
                (studentId) =>
                  Number.isFinite(studentId) && studentId !== activeStudentId,
              ),
          ),
        );

        const studentsByBackendId = buildStudentMapByBackendId(students);

        setBuddyOptions(
          rosterIds
            .map((studentId) => ({
              value: String(studentId),
              label:
                String(studentsByBackendId.get(studentId)?.name || "").trim() ||
                `Student ${studentId}`,
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
        setFormLoadError(
          error?.message || "Unable to load section form configuration.",
        );
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

  const availableFormCount = availableFormList.length;

  const updateSkillScore = (skillId, value) => {
    setSkillScores((current) => ({ ...current, [skillId]: value }));
  };

  const updateTopicRank = (topicId, value) => {
    setTopicRankings((current) => ({ ...current, [topicId]: value }));
  };

  return {
    availableForms,
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
  };
}
