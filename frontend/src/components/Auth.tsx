import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

// 全角を半角に変換する関数
const toHalfWidth = (str: string): string => {
  // 全角数字を半角に変換（より確実な方法）
  const fullWidthNumbers = '０１２３４５６７８９';
  const halfWidthNumbers = '0123456789';
  
  let result = str;
  for (let i = 0; i < fullWidthNumbers.length; i++) {
    result = result.replace(new RegExp(fullWidthNumbers[i], 'g'), halfWidthNumbers[i]);
  }
  
  // 全角英字を半角に変換
  result = result.replace(/[Ａ-Ｚａ-ｚ]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  
  // 全角記号を半角に変換
  result = result.replace(/[！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  
  // 全角スペースを半角に変換
  result = result.replace(/　/g, ' ');
  
  // 長音記号をハイフンに変換
  result = result.replace(/[ー−]/g, '-');
  
  return result;
};

export function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        // ログイン時は電話番号またはメールアドレスを使用
        const loginValue = phone || email;
        if (!loginValue) {
          setError('メールアドレスまたは電話番号を入力してください');
          setIsLoading(false);
          return;
        }
        await login(loginValue, password);
      } else {
        // 新規登録時は電話番号とメールアドレスの両方を送信
        if (!phone && !email) {
          setError('電話番号またはメールアドレスのいずれかが必要です');
          setIsLoading(false);
          return;
        }
        await register(username, password, phone || undefined, email || undefined);
      }
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="rice-decoration left-top">🌾</div>
      <div className="rice-decoration right-top">🌾</div>
      <div className="rice-decoration left-bottom">🌾</div>
      <div className="rice-decoration right-bottom">🌾</div>
      
      <div className="auth-card">
        <div className="auth-header">
          <div className="floating-rice">🌾</div>
          <h1 className="auth-title">工程管理くん</h1>
        </div>

        <div className="auth-tabs">
          <button
            className={`tab-btn ${isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(true);
              setError('');
              setPhone('');
              setEmail('');
              setPassword('');
              setUsername('');
            }}
          >
            ログイン
          </button>
          <button
            className={`tab-btn ${!isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(false);
              setError('');
              setPhone('');
              setEmail('');
              setPassword('');
              setUsername('');
            }}
          >
            新規登録
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="input-group">
              <span className="input-icon">👤</span>
              <input
                type="text"
                placeholder="ユーザー名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="auth-input"
              />
            </div>
          )}

          {isLogin ? (
            <div className="input-group">
              <span className="input-icon">📧</span>
              <input
                type="text"
                placeholder="メールアドレスまたは電話番号"
                value={phone || email}
                onChange={(e) => {
                  const value = toHalfWidth(e.target.value);
                  // @が含まれていればメールアドレス、そうでなければ電話番号として扱う
                  if (value.includes('@')) {
                    setEmail(value);
                    setPhone('');
                  } else {
                    setPhone(value);
                    setEmail('');
                  }
                }}
                className="auth-input"
                required
              />
            </div>
          ) : (
            <>
              <div className="input-group">
                <span className="input-icon">📱</span>
                <input
                  type="tel"
                  placeholder="電話番号（どちらか必須）"
                  value={phone}
                  onChange={(e) => setPhone(toHalfWidth(e.target.value))}
                  className="auth-input"
                  inputMode="numeric"
                />
              </div>
              <div className="input-group">
                <span className="input-icon">📧</span>
                <input
                  type="email"
                  placeholder="メールアドレス（どちらか必須）"
                  value={email}
                  onChange={(e) => setEmail(toHalfWidth(e.target.value))}
                  className="auth-input"
                />
              </div>
            </>
          )}

          <div className="input-group">
            <span className="input-icon">🔒</span>
            <input
              type="password"
              placeholder="パスワード（4文字以上）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="auth-input"
              minLength={4}
            />
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading-spinner"></span>
            ) : (
              <span>{isLogin ? 'ログイン' : '新規登録'}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

