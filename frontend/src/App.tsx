import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Login from './pages/Login';
import { AuthProvider } from './contexts/Auth';
import ProtectedRoute from './components/ProtectedRoute';
import GamePage from './game/GamePage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route path="/game" element={<GamePage />} />
      </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
