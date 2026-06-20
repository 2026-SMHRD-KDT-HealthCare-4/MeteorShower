import { useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api';

export default function SocialCallback() {
  const { provider } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state') ?? '';
    const redirectUri = `${window.location.origin}/patient/auth/callback/${provider}`;

    if (!code) {
      navigate('/patient/login', { replace: true });
      return;
    }

    authApi.socialLogin(provider, { code, redirect_uri: redirectUri, state })
      .then((data) => {
        if (data.status === 'need_signup') {
          sessionStorage.setItem('socialSignup', JSON.stringify(data));
          navigate('/patient/auth/social-signup', { replace: true });
        } else {
          login({ name: data.name, role: 'patient' }, data.token, false);
          navigate('/patient/exercise', { replace: true });
        }
      })
      .catch(() => navigate('/patient/login', { replace: true }));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <span className="material-symbols-outlined animate-spin text-primary-container text-4xl">
          progress_activity
        </span>
        <p className="mt-4 text-on-surface-variant text-body-md">로그인 처리 중...</p>
      </div>
    </div>
  );
}
