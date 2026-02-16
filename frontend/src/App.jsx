import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import CVExtractor from "./Forms/CVExtractor";
import CandidatesList from "./Candidates/CandidatesList";
import CandidatsRefuses from "./Candidates/CandidatsRefuses";
import CandidatsEmbauches from "./Candidates/CandidatsEmbauches";
import Etape_2_Form from "./Forms/Etape_2_Form";
import Etape_3_Form from "./Forms/Etape_3_Form";
import AdminEvaluationCorrection from "./Forms/AdminEvaluationCorrection";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLogin from "./Forms/AdminLogin";
import WelcomePage from "./WelcomePage";
import ListeDépart from "./Candidates/ListeDépart";
import DashboardCharts from "./components/DashboardCharts";
import ChoisirBesoin from "./Forms/ChoisirBesoin";
import DynamicRecruitmentForm from "./Forms/DynamicRecruitmentForm";

export default function QuestionnaireForm() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<WelcomePage />} />
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/form/:token" element={<Etape_2_Form />} />

        {/* Public Evaluation Route */}
        <Route path="/evaluation/:token" element={<Etape_3_Form />} />
        <Route path="/evaluation" element={<Etape_3_Form />} />

        {/* Protected Admin Routes */}
        <Route
          path="/candidates"
          element={
            <ProtectedRoute>
              <CandidatesList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/scan"
          element={
            <ProtectedRoute>
              <CVExtractor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-candidate/:token"
          element={<DynamicRecruitmentForm />}
        />
        <Route
          path="/refused"
          element={
            <ProtectedRoute>
              <CandidatsRefuses />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hired"
          element={
            <ProtectedRoute>
              <CandidatsEmbauches />
            </ProtectedRoute>
          }
        />
        <Route
          path="/liste-depart"
          element={
            <ProtectedRoute>
              <ListeDépart />
            </ProtectedRoute>
          }
        />
        <Route
          path="/evaluation/admin/:id"
          element={
            <ProtectedRoute>
              <AdminEvaluationCorrection />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardCharts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/choisir-besoin"
          element={
            <ProtectedRoute>
              <ChoisirBesoin />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
