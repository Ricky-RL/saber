import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Login from './pages/Login';
import { AuthProvider } from './contexts/Auth';
import ProtectedRoute from './components/ProtectedRoute';
import GamePage from './game/GamePage';
import AvatarPage from './pages/Avatar';
import WrappedPage from './pages/Wrapped';
import DifficultySelection from './pages/DifficultySelection';

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
          <Route path="/difficulty" element={<DifficultySelection />} />
          <Route path="/game" element={<GamePage />} />
          <Route path="/avatar" element={<AvatarPage />} />
          <Route
            path="/wrapped"
            element={
              <ProtectedRoute>
                <WrappedPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
