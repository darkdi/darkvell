import React from "react";
import ReactDOM from "react-dom/client";
import {
  Activity,
  Clock,
  Coins,
  Database,
  Ghost,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Swords,
  UserRound,
  Users,
  WalletCards,
  X
} from "lucide-react";
import "./styles.css";

interface HealthState {
  ok: boolean;
  service: string;
  players?: number;
  tick?: number;
  network?: string;
}

interface CharacterRow {
  characterId: string;
  name: string;
  classId: string;
  race: string;
  level: number;
  xp: number;
  gold: number;
  karma: number;
  pkCount: number;
  pvpCount: number;
  clanId?: string;
  arenaRating: number;
  arenaWins: number;
  arenaLosses: number;
  inventoryCount: number;
  equipmentCount: number;
  firstSeenAt?: number;
  lastSeenAt?: number;
  accountLogin?: string;
  accountCreatedAt?: string;
  registered: boolean;
}

interface CharacterDirectory {
  generatedAt: string;
  summary: {
    total: number;
    registered: number;
    withoutAccount: number;
    activeLast24h: number;
    activeLast7d: number;
    maxLevel: number;
    totalGold: number;
  };
  characters: CharacterRow[];
}

// Registration dates are absolute rather than relative: knowing someone signed
// up on 3 августа is more useful in a roster than "4 дня назад".
function formatRegistered(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// Characters saved before last-seen tracking landed have no timestamp, which is
// different from "never played" and should not be shown as a date.
function formatSeen(at?: number): { text: string; stale: boolean } {
  if (!at) {
    return { text: "—", stale: true };
  }

  const minutes = Math.floor((Date.now() - at) / 60_000);
  if (minutes < 1) {
    return { text: "только что", stale: false };
  }
  if (minutes < 60) {
    return { text: `${minutes} мин назад`, stale: false };
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return { text: `${hours} ч назад`, stale: false };
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return { text: `${days} дн назад`, stale: days > 7 };
  }
  return { text: new Date(at).toLocaleDateString("ru-RU"), stale: true };
}

interface LoginResponse {
  token: string;
  player: { username: string; character?: { name: string } };
}

const runtimeUrl = (configuredUrl: string | undefined, fallbackUrl: string) =>
  (configuredUrl?.trim() || fallbackUrl).replace(/\/+$/, "");

const authUrl = runtimeUrl(import.meta.env.VITE_AUTH_API_URL, "/auth");
const services = [
  { id: "game", label: "Игра", url: `${runtimeUrl(import.meta.env.VITE_GAME_API_URL, "/game")}/health` },
  { id: "auth", label: "Аккаунты", url: `${authUrl}/health` },
  { id: "chain", label: "Кошелёк", url: `${runtimeUrl(import.meta.env.VITE_BLOCKCHAIN_API_URL, "/blockchain")}/health` }
];

const classNames: Record<string, string> = {
  warrior: "Воин",
  knight: "Рыцарь",
  rogue: "Разбойник",
  assassin: "Ассасин",
  archer: "Лучник",
  mage: "Маг",
  cleric: "Жрец",
  tank: "Танк"
};

const raceNames: Record<string, string> = {
  human: "Человек",
  elf: "Эльф",
  darkelf: "Тёмный эльф",
  orc: "Орк"
};

const number = new Intl.NumberFormat("ru-RU");
const savedTokenKey = "darkvell-admin-token";

function App() {
  const [token, setToken] = React.useState(() => window.sessionStorage.getItem(savedTokenKey) ?? "");
  const [login, setLogin] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loginBusy, setLoginBusy] = React.useState(false);
  const [loginError, setLoginError] = React.useState("");
  const [adminName, setAdminName] = React.useState("");
  const [health, setHealth] = React.useState<Record<string, HealthState | undefined>>({});
  const [healthErrors, setHealthErrors] = React.useState<Record<string, boolean>>({});
  const [directory, setDirectory] = React.useState<CharacterDirectory | null>(null);
  const [directoryError, setDirectoryError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [accountFilter, setAccountFilter] = React.useState<"all" | "registered" | "without">("all");
  const [selected, setSelected] = React.useState<CharacterRow | null>(null);

  const loadDirectory = React.useCallback(async (activeToken = token) => {
    if (!activeToken) {
      return;
    }
    setLoading(true);
    setDirectoryError("");
    try {
      const response = await fetch(`${authUrl}/admin/characters`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (response.status === 401) {
        window.sessionStorage.removeItem(savedTokenKey);
        setToken("");
        setDirectory(null);
        throw new Error("Сессия закончилась или у персонажа нет прав администратора.");
      }
      if (!response.ok) {
        throw new Error("Не удалось получить список персонажей.");
      }
      setDirectory((await response.json()) as CharacterDirectory);
    } catch (error) {
      setDirectoryError(error instanceof Error ? error.message : "Ошибка загрузки.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    let cancelled = false;
    async function pollHealth() {
      await Promise.all(
        services.map(async (service) => {
          try {
            const response = await fetch(service.url);
            if (!response.ok) {
              throw new Error("offline");
            }
            const data = (await response.json()) as HealthState;
            if (!cancelled) {
              setHealth((current) => ({ ...current, [service.id]: data }));
              setHealthErrors((current) => ({ ...current, [service.id]: false }));
            }
          } catch {
            if (!cancelled) {
              setHealthErrors((current) => ({ ...current, [service.id]: true }));
            }
          }
        })
      );
    }
    void pollHealth();
    const timer = window.setInterval(pollHealth, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  React.useEffect(() => {
    if (token) {
      void loadDirectory(token);
    }
  }, [token, loadDirectory]);

  async function submitLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    try {
      const response = await fetch(`${authUrl}/account/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password, locale: "ru" })
      });
      if (!response.ok) {
        throw new Error("Неверный логин или пароль.");
      }
      const session = (await response.json()) as LoginResponse;
      window.sessionStorage.setItem(savedTokenKey, session.token);
      setAdminName(session.player.character?.name ?? session.player.username);
      setPassword("");
      setToken(session.token);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Не удалось войти.");
    } finally {
      setLoginBusy(false);
    }
  }

  function logout() {
    window.sessionStorage.removeItem(savedTokenKey);
    setToken("");
    setDirectory(null);
    setSelected(null);
    setAdminName("");
  }

  const filteredCharacters = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ru");
    return (directory?.characters ?? []).filter((character) => {
      const matchesAccount =
        accountFilter === "all" ||
        (accountFilter === "registered" && character.registered) ||
        (accountFilter === "without" && !character.registered);
      const haystack = `${character.name} ${character.accountLogin ?? ""} ${character.characterId} ${character.classId}`.toLocaleLowerCase("ru");
      return matchesAccount && (!query || haystack.includes(query));
    });
  }, [accountFilter, directory, search]);

  if (!token) {
    return (
      <main className="loginPage">
        <section className="loginCard">
          <div className="brandMark"><ShieldCheck size={28} /></div>
          <p className="eyebrow">DARKVELL CONTROL</p>
          <h1>Панель владельца</h1>
          <p className="loginHint">Войди аккаунтом персонажа Unit или Houston. Данные игроков доступны только администраторам.</p>
          <form onSubmit={submitLogin}>
            <label>
              Логин или email
              <input autoComplete="username" value={login} onChange={(event) => setLogin(event.target.value)} required />
            </label>
            <label>
              Пароль
              <input
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {loginError ? <p className="formError">{loginError}</p> : null}
            <button className="primaryButton" disabled={loginBusy} type="submit">
              {loginBusy ? <RefreshCw className="spin" size={18} /> : <ShieldCheck size={18} />}
              {loginBusy ? "Проверяю…" : "Войти в админку"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="adminShell">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark"><ShieldCheck size={23} /></div>
          <div>
            <p className="eyebrow">DARKVELL CONTROL</p>
            <h1>Персонажи</h1>
          </div>
        </div>
        <div className="topbarActions">
          {services.map((service) => {
            const offline = healthErrors[service.id];
            return (
              <span className={`servicePill ${offline ? "offline" : ""}`} key={service.id}>
                <i />
                {service.label}
                {service.id === "game" && health.game?.players !== undefined ? ` · ${health.game.players}` : ""}
              </span>
            );
          })}
          <button className="iconButton" onClick={logout} title={adminName ? `Выйти: ${adminName}` : "Выйти"}>
            <LogOut size={19} />
          </button>
        </div>
      </header>

      <section className="content">
        <div className="summaryGrid">
          <SummaryCard icon={<Users />} label="Всего персонажей" value={number.format(directory?.summary.total ?? 0)} />
          <SummaryCard icon={<UserRound />} label="Зарегались" value={number.format(directory?.summary.registered ?? 0)} accent="blue" />
          <SummaryCard icon={<Ghost />} label="Гости, без аккаунта" value={number.format(directory?.summary.withoutAccount ?? 0)} accent="violet" />
          <SummaryCard icon={<Activity />} label="Заходили за сутки" value={number.format(directory?.summary.activeLast24h ?? 0)} accent="green" />
          <SummaryCard icon={<Clock />} label="Заходили за неделю" value={number.format(directory?.summary.activeLast7d ?? 0)} accent="blue" />
          <SummaryCard icon={<Swords />} label="Максимальный уровень" value={number.format(directory?.summary.maxLevel ?? 0)} accent="violet" />
          <SummaryCard icon={<Coins />} label="Золото у игроков" value={number.format(directory?.summary.totalGold ?? 0)} accent="gold" />
        </div>

        <section className="directoryPanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">БАЗА ПЕРСОНАЖЕЙ</p>
              <h2>Все сохранённые герои</h2>
            </div>
            <button className="refreshButton" disabled={loading} onClick={() => void loadDirectory()}>
              <RefreshCw className={loading ? "spin" : ""} size={17} />
              Обновить
            </button>
          </div>

          <div className="filters">
            <label className="searchBox">
              <Search size={18} />
              <input
                placeholder="Ник, email, ID или класс…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search ? <button onClick={() => setSearch("")}><X size={16} /></button> : null}
            </label>
            <div className="filterTabs">
              <button className={accountFilter === "all" ? "active" : ""} onClick={() => setAccountFilter("all")}>Все</button>
              <button className={accountFilter === "registered" ? "active" : ""} onClick={() => setAccountFilter("registered")}>С аккаунтом</button>
              <button className={accountFilter === "without" ? "active" : ""} onClick={() => setAccountFilter("without")}>Гости</button>
            </div>
          </div>

          {directoryError ? (
            <div className="errorState"><Activity size={20} />{directoryError}</div>
          ) : (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Персонаж</th>
                    <th>Уровень</th>
                    <th>Класс</th>
                    <th>Аккаунт / email</th>
                    <th>Зарегался</th>
                    <th>Последний вход</th>
                    <th>Золото</th>
                    <th>Арена</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCharacters.map((character) => {
                    const seen = formatSeen(character.lastSeenAt);
                    return (
                      <tr key={character.characterId} onClick={() => setSelected(character)}>
                        <td>
                          <div className="characterCell">
                            <span className={`avatar class-${character.classId}`}>{character.name.slice(0, 1).toUpperCase()}</span>
                            <div><strong>{character.name}</strong><small>{raceNames[character.race] ?? character.race}</small></div>
                          </div>
                        </td>
                        <td><span className="levelBadge">{character.level}</span></td>
                        <td>{classNames[character.classId] ?? character.classId}</td>
                        <td>
                          {character.accountLogin ? <span className="accountLogin">{character.accountLogin}</span> : <span className="muted">Гость</span>}
                        </td>
                        <td className={character.accountCreatedAt ? undefined : "muted"}>
                          {character.accountCreatedAt ? formatRegistered(character.accountCreatedAt) : "—"}
                        </td>
                        <td className={seen.stale ? "muted" : undefined}>{seen.text}</td>
                        <td>{number.format(character.gold)}</td>
                        <td>{number.format(character.arenaRating)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!loading && filteredCharacters.length === 0 ? <div className="emptyState">Ничего не найдено</div> : null}
            </div>
          )}
          <footer className="panelFooter">
            <span>Показано: {number.format(filteredCharacters.length)}</span>
            <span>Обновлено: {directory ? new Date(directory.generatedAt).toLocaleTimeString("ru-RU") : "—"}</span>
          </footer>
        </section>
      </section>

      {selected ? <CharacterDetails character={selected} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}

function SummaryCard({ icon, label, value, accent = "green" }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <article className={`summaryCard ${accent}`}>
      <div className="summaryIcon">{icon}</div>
      <div><span>{label}</span><strong>{value}</strong></div>
    </article>
  );
}

function CharacterDetails({ character, onClose }: { character: CharacterRow; onClose: () => void }) {
  return (
    <div className="detailsBackdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="detailsPanel">
        <button className="detailsClose" onClick={onClose}><X size={20} /></button>
        <div className="detailsHero">
          <span className={`avatar large class-${character.classId}`}>{character.name.slice(0, 1).toUpperCase()}</span>
          <div><p className="eyebrow">ПЕРСОНАЖ</p><h2>{character.name}</h2><span>{classNames[character.classId] ?? character.classId} · {raceNames[character.race] ?? character.race}</span></div>
        </div>
        <div className="detailsStats">
          <Detail label="Уровень" value={number.format(character.level)} />
          <Detail label="Опыт" value={number.format(character.xp)} />
          <Detail label="Золото" value={number.format(character.gold)} />
          <Detail label="Карма" value={number.format(character.karma)} />
          <Detail label="PvP" value={number.format(character.pvpCount)} />
          <Detail label="PK" value={number.format(character.pkCount)} />
          <Detail label="Рейтинг арены" value={number.format(character.arenaRating)} />
          <Detail label="Победы / поражения" value={`${character.arenaWins} / ${character.arenaLosses}`} />
          <Detail label="Предметов в сумке" value={number.format(character.inventoryCount)} />
          <Detail label="Надето предметов" value={number.format(character.equipmentCount)} />
        </div>
        <div className="accountCard">
          <Database size={19} />
          <div>
            <span>Аккаунт / email</span>
            <strong>{character.accountLogin ?? "Гость, аккаунта нет"}</strong>
            {character.accountCreatedAt ? <small>Зарегался {new Date(character.accountCreatedAt).toLocaleDateString("ru-RU")}</small> : null}
          </div>
        </div>
        <div className="accountCard">
          <Clock size={19} />
          <div>
            <span>Игровая активность</span>
            <strong>
              {character.lastSeenAt ? `Последний вход: ${new Date(character.lastSeenAt).toLocaleString("ru-RU")}` : "Последний вход неизвестен"}
            </strong>
            <small>
              {character.firstSeenAt
                ? `Первый вход: ${new Date(character.firstSeenAt).toLocaleString("ru-RU")}`
                : "Персонаж создан до того, как включили учёт входов"}
            </small>
          </div>
        </div>
        <div className="idLine"><span>ID</span><code>{character.characterId}</code></div>
      </aside>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="detail"><span>{label}</span><strong>{value}</strong></div>;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode><App /></React.StrictMode>
);
