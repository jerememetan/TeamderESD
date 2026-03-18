import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { mockCourses, mockForms } from "../app/data/mockData";

function CreateForm() {
  const { courseId } = useParams();

  // THESE ARE THE DATA THAT NEED TO COME FROM BACKEND LATER
  const courseList = mockCourses;
  const existingFormMap = mockForms;

  const selectedCourse = courseList.find((course) => course.id === courseId);
  const existingForm = existingFormMap[courseId || ""] || existingFormMap["1"];

  const initialCriteria = useMemo(
    () =>
      existingForm?.criteria?.map((criterion) => ({
        id: criterion.id,
        question: criterion.question,
        weight: criterion.weight,
      })) || [
        { id: "c1", question: "Technical skill in backend development", weight: 0.3 },
        { id: "c2", question: "Communication and teamwork", weight: 0.2 },
      ],
    [existingForm],
  );

  const [groupSize, setGroupSize] = useState(existingForm?.groupSize ?? 5);
  const [minimumGroupSize, setMinimumGroupSize] = useState(
    existingForm?.minimumGroupSize ?? 4,
  );
  const [mixGender, setMixGender] = useState(existingForm?.mixGender ?? true);
  const [mixYear, setMixYear] = useState(existingForm?.mixYear ?? true);
  const [allowBuddy, setAllowBuddy] = useState(existingForm?.allowBuddy ?? true);
  const [criteria, setCriteria] = useState(initialCriteria);

  if (!selectedCourse) {
    return <div className="max-w-7xl mx-auto px-4 py-8">Course not found</div>;
  }

  const addCriterion = () => {
    setCriteria((currentCriteria) => [
      ...currentCriteria,
      {
        id: `criterion-${Date.now()}`,
        question: "",
        weight: 0.1,
      },
    ]);
  };

  const updateCriterion = (criterionId, updates) => {
    setCriteria((currentCriteria) =>
      currentCriteria.map((criterion) =>
        criterion.id === criterionId ? { ...criterion, ...updates } : criterion,
      ),
    );
  };

  const removeCriterion = (criterionId) => {
    setCriteria((currentCriteria) =>
      currentCriteria.filter((criterion) => criterion.id !== criterionId),
    );
  };

  const totalWeight = criteria.reduce(
    (sum, criterion) => sum + Number(criterion.weight || 0),
    0,
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/instructor/courses"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Courses
      </Link>

      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Create Group Formation Form
        </h2>
        <p className="text-gray-600">
          {selectedCourse.code} - {selectedCourse.name}
        </p>
        <p className="mt-2 text-sm text-gray-500">
          This form is course-wide. Students will later rate themselves from 1 to 5
          for each criterion you define here.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Group Setup Rules</h3>
        <p className="mb-4 text-sm text-gray-600">
          Fields in this section should come from the course-wide team formation
          settings that instructors save for the selected course.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred group size
            </label>
            <input
              type="number"
              min="2"
              value={groupSize}
              onChange={(event) => setGroupSize(Number(event.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum group size
            </label>
            <input
              type="number"
              min="2"
              value={minimumGroupSize}
              onChange={(event) => setMinimumGroupSize(Number(event.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-2 text-xs text-gray-500">
              Keep this if you want flexibility. If not needed later, we can remove it.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
            <input
              type="checkbox"
              checked={mixGender}
              onChange={(event) => setMixGender(event.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="block font-medium text-gray-900">Mix gender</span>
              <span className="block text-sm text-gray-600">
                Encourage mixed-gender grouping where possible.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
            <input
              type="checkbox"
              checked={mixYear}
              onChange={(event) => setMixYear(event.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="block font-medium text-gray-900">Mix year</span>
              <span className="block text-sm text-gray-600">
                Encourage year-level diversity where possible.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
            <input
              type="checkbox"
              checked={allowBuddy}
              onChange={(event) => setAllowBuddy(event.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="block font-medium text-gray-900">Allow buddy requests</span>
              <span className="block text-sm text-gray-600">
                Students can request one another to be paired together.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Criteria</h3>
            <p className="text-sm text-gray-600">
              Students will answer every criterion using a 1 to 5 scale.
            </p>
          </div>
          <button
            onClick={addCriterion}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Criterion
          </button>
        </div>

        <div className="space-y-4">
          {criteria.map((criterion, index) => (
            <div
              key={criterion.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Criterion {index + 1}
                    </label>
                    <input
                      type="text"
                      value={criterion.question}
                      onChange={(event) =>
                        updateCriterion(criterion.id, { question: event.target.value })
                      }
                      placeholder="Example: Confidence in backend development"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Weight
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={criterion.weight}
                      onChange={(event) =>
                        updateCriterion(criterion.id, {
                          weight: Number(event.target.value),
                        })
                      }
                      className="w-full md:w-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <button
                  onClick={() => removeCriterion(criterion.id)}
                  className="mt-2 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Current total weight: <span className="font-semibold">{totalWeight.toFixed(2)}</span>.
        It is usually best if the final total is close to 1.00.
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Backend data this page will eventually need</p>
        <p className="mt-2">
          `courseId`, course details, existing form settings, saved criteria,
          current publish status, and later the create/update API endpoints for
          saving draft vs publishing the form.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Save as Draft
        </button>
        <button className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          Publish Form
        </button>
        <button className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default CreateForm;
