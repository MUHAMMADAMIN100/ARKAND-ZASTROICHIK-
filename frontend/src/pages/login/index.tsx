import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ShieldCheck, Boxes, LineChart } from "lucide-react";
import { Button, Field, Input } from "@/shared/ui";
import { apiError } from "@/shared/api/client";
import { tokenStore } from "@/shared/api/token";
import { useLogin, useSession } from "@/entities/session";
import logoUrl from "@/shared/assets/logo.png";
import "./login.css";

export function LoginPage() {
  const user = useSession((s) => s.user);
  const navigate = useNavigate();
  const login = useLogin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (user && tokenStore.get()) return <Navigate to="/" replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    login.mutate(
      { username: username.trim(), password },
      {
        onSuccess: () => navigate("/", { replace: true }),
        onError: (err) => setError(apiError(err)),
      }
    );
  };

  return (
    <div className="login">
      <aside className="login__aside">
        <div className="login__brand">
          <img src={logoUrl} alt="Arkand" />
          <span>Застройщик</span>
        </div>
        <div className="login__pitch">
          <h2>Единая система застройщика холдинга</h2>
          <p>
            Объекты, заявки, склад и накладные, смета план/факт, финансы и инвентаризация —
            в одном месте, в разрезе объекта и города.
          </p>
        </div>
        <div className="login__features">
          <div className="login__feature">
            <Boxes size={18} /> Склад и движение материалов по накладным
          </div>
          <div className="login__feature">
            <LineChart size={18} /> Смета план/факт и прибыль по объекту
          </div>
          <div className="login__feature">
            <ShieldCheck size={18} /> Инвентаризация с блокировкой движений
          </div>
        </div>
      </aside>

      <main className="login__main">
        <form className="login__form" onSubmit={submit}>
          <h1>Вход в систему</h1>
          <p>Введите логин и пароль вашей роли</p>

          {error && <div className="login__error">{error}</div>}

          <div className="stack">
            <Field label="Логин">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="например, prorab"
                autoFocus
                autoComplete="username"
              />
            </Field>
            <Field label="Пароль">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </Field>
            <Button type="submit" size="lg" block loading={login.isPending}>
              Войти
            </Button>
          </div>

          <div className="login__demo">
            <b>Демо-доступы:</b>
            <div className="login__demo-row">
              <span>Администратор</span> <code>admin / admin123</code>
            </div>
            <div className="login__demo-row">
              <span>Владелец (Сохиб)</span> <code>sohib / sohib123</code>
            </div>
            <div className="login__demo-row">
              <span>Прораб</span> <code>prorab / prorab123</code>
            </div>
            <div className="login__demo-row">
              <span>Кладовщик</span> <code>sklad / sklad123</code>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
