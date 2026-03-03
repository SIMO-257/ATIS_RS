import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import '../styles/DashboardCharts.css';
import { API_URL } from '../config';

const DashboardCharts = () => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (isInitialLoad.current) setLoading(true);
        const year = new Date().getFullYear();
        const response = await fetch(`${API_URL}/candidates/stats?year=${year}`);
        const result = await response.json();
        if (result.success) {
          setChartData(result.data || []);
        } else {
          console.error("Failed to load stats:", result.error);
        }
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        isInitialLoad.current = false;
        setLoading(false);
      }
    };

    fetchStats();
    const intervalId = setInterval(fetchStats, 3000);
    return () => clearInterval(intervalId);
  }, []);

  if (loading) {
    return <div className="dashboard-charts">Loading chart data...</div>;
  }

  return (
    <div className="dashboard-charts">
      <h2>Monthly Statistics for {new Date().getFullYear()}</h2>

      <div className="chart-container">
        <h3>Candidats Acceptés / Embauchés</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="acceptes" fill="#FFEB3B" name="Acceptés">
              <LabelList dataKey="acceptes" position="top" />
            </Bar>
            <Bar dataKey="embauches" fill="#4CAF50" name="Embauchés">
              <LabelList dataKey="embauches" position="top" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-container">
        <h3>Candidats Ajoutés / Refusés</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="candidats" fill="#2196F3" name="Candidats">
              <LabelList dataKey="candidats" position="top" />
            </Bar>
            <Bar dataKey="refuses" fill="#F44336" name="Refusés">
              <LabelList dataKey="refuses" position="top" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-container">
        <h3>Départs</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="depart" fill="#ff7300" name="Départs">
              <LabelList dataKey="depart" position="top" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DashboardCharts;
