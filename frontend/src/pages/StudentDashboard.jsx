import { Link } from 'react-router';
import { FileText, Users, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import { currentStudent, currentStudentTeam, mockForms } from "../app/data/mockData";

function StudentDashBoard(){

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Student Dashboard</h2>
        <p className="text-gray-600">Welcome back, {currentStudent.name}!</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">1</p>
          <p className="text-sm text-gray-600">Active Team</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">1</p>
          <p className="text-sm text-gray-600">Forms Completed</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">0</p>
          <p className="text-sm text-gray-600">Pending Requests</p>
        </div>
      </div>
       {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link
          to="/student/team"
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow group"
        >
          <Users className="w-10 h-10 text-blue-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">My Team</h3>
          <p className="text-sm text-gray-600 mb-4">
            View your current team members and request team swaps
          </p>
          <div className="flex items-center text-blue-600 text-sm font-medium group-hover:gap-2 transition-all">
            View Team <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </Link>

        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <FileText className="w-10 h-10 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Available Forms</h3>
          <p className="text-sm text-gray-600 mb-4">No new forms at this time</p>
        </div>
      </div>

      {/* Current Team */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Current Team</h3>
          <Link
            to="/student/team"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            View Details →
          </Link>
        </div>

        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
          <div>
            <h4 className="font-semibold text-gray-900 text-lg mb-1">
              {currentStudentTeam.name}
            </h4>
            <p className="text-sm text-gray-600">
              {currentStudentTeam.members.length} members
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {currentStudentTeam.formationScore}
              </p>
              <p className="text-xs text-gray-600">Team Score</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Form History</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">
                  Team Formation Survey - Fall 2026
                </h4>
                <p className="text-sm text-gray-600">Completed on March 5, 2026</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              Completed
            </span>
          </div>
        </div>
      </div>
      </div>
    )
}

export default StudentDashBoard