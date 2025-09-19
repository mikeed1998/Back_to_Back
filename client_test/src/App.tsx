import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';


const App: React.FC = () => {
	const { user, loading } = useAuth();

	if (loading) {
		return <div className="loading">Cargando...</div>;
	}

	return (
		<Router>
			<div className="app">
				{user && <Navbar />}
				
				<main className="main-content">
					<Routes>
						<Route 
							path="/login" 
							element={user ? <Navigate to="/dashboard" /> : <Login />} 
						/>
						<Route 
							path="/dashboard" 
							element={
								<ProtectedRoute>
								<Dashboard />
								</ProtectedRoute>
							} 
						/>
						<Route 
							path="/" 
							element={<Navigate to={user ? "/dashboard" : "/login"} />} 
						/>
					</Routes>
				</main>
			</div>
		</Router>
	);
};

export default App;