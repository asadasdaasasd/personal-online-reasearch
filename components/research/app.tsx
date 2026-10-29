"use client";
import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Target,
  NotebookPen,
  FlaskConical,
  Library,
  ChartNoAxesCombined,
  Database,
  Settings,
  Search,
  Plus,
  ChevronRight,
  ArrowUpRight,
  Clock,
  Check,
  CheckCheck,
  CalendarDays,
  Sun,
  Moon,
  PanelLeftClose,
  Menu,
  Play,
  Pause,
  Square,
  LogOut,
  ShieldCheck,
  ArrowDownToLine,
  RotateCcw,
  FolderOpen,
  MoreHorizontal,
  Activity,
  Flag,
  Sparkles,
  LayoutGrid,
  List,
  ChevronLeft,
  FileText,
  RefreshCw,
  X,
} from "lucide-react";
import {
  type Kind,
  type Store,
  type ResearchRecord,
  emptyStore,
  dateToday,
  statistics,
  progress,
  labels,
  statuses,
  kinds,
} from "@/lib/domain";
import { Editor, api, toInput } from "./editor";
import {
  PanelTitle,
  Empty,
  TaskRow,
  ProjectCard,
  Heatmap,
  Calendar,
  Progress,
} from "./views";
import { Timer } from "./timer";
import { Stats } from "./stats";
import { DataManagement } from "./data-management";
type View =
  | "dashboard"
  | "goals"
  | "logs"
  | "experiments"
  | "achievements"
  | "stats"
  | "data"
  | "settings";
const nav = [
  { id: "dashboard", label: "科研总览", icon: LayoutDashboard },
  { id: "goals", label: "研究目标", icon: Target },
  { id: "logs", label: "每日科研日志", icon: NotebookPen },
  { id: "experiments", label: "实验管理", icon: FlaskConical },
  { id: "achievements", label: "研究成果", icon: Library },
  { id: "stats", label: "科研统计", icon: ChartNoAxesCombined },
] as const;
const subtitles: Record<View, string> = {
  dashboard: "每一个小小的发现，都在让研究向前。",
  goals: "从长远目标，到今天值得完成的一步。",
  logs: "记录过程，让思考和发现都有迹可循。",
  experiments: "保留每一次尝试，让结果可以复现。",
  achievements: "把阶段性的发现，沉淀为长期的知识。",
  stats: "用真实记录，观察科研工作的节奏。",
  data: "你的研究资料，始终由你掌握。",
  settings: "让工作台适合你的工作习惯。",
};
type Selection = { kind: Kind; record?: ResearchRecord; date?: string };
export default function ResearchApp({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const [store, setStore] = useState<Store>(emptyStore),
    [view, setView] = useState<View>("dashboard"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [selection, setSelection] = useState<Selection | null>(null),
    [search, setSearch] = useState(""),
    [mobile, setMobile] = useState(false),
    [dark, setDark] = useState(false);
  const [goalKind, setGoalKind] = useState<Kind>("projects"),
    [filterProject, setFilterProject] = useState(""),
    [filterStatus, setFilterStatus] = useState(""),
    [priority, setPriority] = useState(""),
    [type, setType] = useState(""),
    [stage, setStage] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [mode, setMode] = useState("list"),
    [compare, setCompare] = useState<string[]>([]);
  const load = useCallback(async () => {
    try {
      const data = await api<Store>("/api/records");
      setStore(data);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load().catch(() => {});
    const isDark = localStorage.getItem("research-os-theme") === "dark";
    setDark(isDark);
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    const read = () => {
      const v = new URLSearchParams(location.search).get("view") as View;
      if (
        [
          "dashboard",
          "goals",
          "logs",
          "experiments",
          "achievements",
          "stats",
          "data",
          "settings",
        ].includes(v)
      )
        setView(v);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [load]);
  useEffect(() => {
    if (!loading) {
      const q = new URLSearchParams(location.search),
        k = q.get("kind") as Kind,
        id = q.get("record");
      if (kinds.includes(k) && id) {
        const r = store[k].find((r) => r.id === id);
        if (r) setSelection({ kind: k, record: r });
      }
    }
  }, [loading]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  function go(v: View) {
    setView(v);
    setMobile(false);
    setSearch("");
    setFilterProject("");
    setFilterStatus("");
    setPriority("");
    setType("");
    setStage("");
    setFrom("");
    setTo("");
    setMode("list");
    setCompare([]);
    history.pushState(null, "", `/?view=${v}`);
  }
  function open(kind: Kind, record?: ResearchRecord, date?: string) {
    setSelection({ kind, record, date });
    if (record)
      history.replaceState(
        null,
        "",
        `/?view=${view}&kind=${kind}&record=${record.id}`,
      );
  }
  function close() {
    setSelection(null);
    history.replaceState(null, "", `/?view=${view}`);
  }
  async function toggle(r: ResearchRecord) {
    try {
      await api(`/api/records/tasks/${r.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...toInput(r),
          status: r.status === "done" ? "planned" : "done",
        }),
      });
      await load();
      setToast(r.status === "done" ? "任务已重新打开" : "任务已完成");
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  function theme() {
    const v = !dark;
    setDark(v);
    document.documentElement.dataset.theme = v ? "dark" : "light";
    localStorage.setItem("research-os-theme", v ? "dark" : "light");
  }
  const title =
      nav.find((n) => n.id === view)?.label ||
      (view === "data" ? "数据管理" : "设置"),
    today = dateToday(),
    stats = statistics(store),
    kind: Kind =
      view === "goals"
        ? goalKind
        : view === "experiments"
          ? "experiments"
          : view === "achievements"
            ? "achievements"
            : "logs";
  const filtered = store[kind]
    .filter(
      (r) =>
        (!filterProject ||
          r.project_id === filterProject ||
          r.id === filterProject) &&
        (!filterStatus || r.status === filterStatus) &&
        (!priority || r.data.priority === priority) &&
        (!type || r.data.type === type) &&
        (!stage || r.milestone_id === stage) &&
        (!from || r.date >= from) &&
        (!to || r.date <= to) &&
        (!search ||
          JSON.stringify(r).toLowerCase().includes(search.toLowerCase())),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.updated_at.localeCompare(a.updated_at),
    );
  const results = search
    ? kinds
        .flatMap((k) =>
          store[k]
            .filter((r) =>
              JSON.stringify({ title: r.title, data: r.data })
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((r) => ({ kind: k, record: r })),
        )
        .slice(0, 15)
    : [];
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go("dashboard");
          }}
        >
          <span className="brand-mark">
            <Activity size={22} />
          </span>
          <span>
            Research OS<small>个人科研工作台</small>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">R</span>
          <span>
            我的研究空间
            <small>
              <span className="green-dot" /> 私人工作空间
            </small>
          </span>
          <ShieldCheck size={15} />
        </div>
        <div className="nav-caption">工作空间</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${view === n.id ? "selected" : ""}`}
              onClick={() => go(n.id)}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.id === "goals" &&
                store.tasks.filter((t) => t.status === "active").length > 0 && (
                  <small>{stats.active}</small>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-projects">
          <div className="nav-caption row">
            进行中的项目
            <button
              className="icon-button"
              aria-label="新增项目"
              onClick={() => open("projects")}
            >
              <Plus size={14} />
            </button>
          </div>
          {store.projects
            .filter((p) => p.status === "active")
            .slice(0, 4)
            .map((p) => (
              <button
                className="project-nav"
                key={p.id}
                onClick={() => open("projects", p)}
              >
                <span className="project-dot" />
                {p.title}
              </button>
            ))}
          {!store.projects.some((p) => p.status === "active") && (
            <p className="sidebar-hint">
              从一个研究问题开始
              <br />
              <button onClick={() => open("projects")}>
                创建第一个项目 <Plus size={12} />
              </button>
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <Timer
            logs={store.logs}
            onNew={() => open("logs")}
            onUpdate={load}
            notify={setToast}
          />
          <button
            className={`nav-item ${view === "data" ? "selected" : ""}`}
            onClick={() => go("data")}
          >
            <Database size={17} />
            数据管理
          </button>
          <button
            className={`nav-item ${view === "settings" ? "selected" : ""}`}
            onClick={() => go("settings")}
          >
            <Settings size={17} />
            设置
          </button>
          <div className="profile">
            <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
            <span>
              我的账户<small title={email}>{email}</small>
            </span>
            <button
              title={dark ? "切换浅色主题" : "切换深色主题"}
              aria-label="切换主题"
              className="icon-button"
              onClick={theme}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </aside>
      {mobile && (
        <div className="sidebar-overlay" onClick={() => setMobile(false)} />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="row">
            <button
              className="icon-button mobile-menu"
              aria-label="展开导航"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={19} />
            </button>
            <span className="breadcrumb">工作空间</span>
            <ChevronRight size={13} />
            <span>{title}</span>
          </div>
          <div className="header-actions">
            <div className="search-wrap">
              <Search size={16} />
              <input
                aria-label="全局搜索"
                placeholder="搜索研究、日志、实验…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button aria-label="清空搜索" onClick={() => setSearch("")}>
                  <X size={14} />
                </button>
              )}
              {search && (
                <div className="search-results">
                  {results.map(({ kind: k, record: r }) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        open(k, r);
                        setSearch("");
                      }}
                    >
                      <span>{r.title}</span>
                      <small>{labels[k]}</small>
                    </button>
                  ))}
                  {!results.length && <p>没有找到相关记录</p>}
                </div>
              )}
            </div>
            <span className="private-label">
              <ShieldCheck size={14} />
              仅自己可见
            </span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "dashboard"
                  ? "YOUR RESEARCH, CONNECTED"
                  : "RESEARCH WORKSPACE"}
              </div>
              <h1>
                {view === "dashboard" ? "科研总览" : title}
                <span className="heading-dot">.</span>
              </h1>
              <p>{subtitles[view]}</p>
            </div>
            {!["dashboard", "stats", "data", "settings"].includes(view) && (
              <button className="button primary" onClick={() => open(kind)}>
                <Plus size={17} />
                新建{labels[kind]}
              </button>
            )}
            {view === "dashboard" && (
              <span className="date-label">
                <CalendarDays size={16} />
                {new Date(today + "T12:00:00").toLocaleDateString("zh-CN", {
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })}
              </span>
            )}
          </div>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button
                className="button"
                onClick={() => {
                  setLoading(true);
                  void load().catch(() => {});
                }}
              >
                <RefreshCw size={14} />
                重试
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-state">
              <RefreshCw className="spin" size={24} />
              <p>正在加载你的研究空间…</p>
            </div>
          ) : error ? (
            <div className="empty">
              <Database />
              <h3>暂时无法读取研究数据</h3>
              <p>恢复连接后重试，统计不会使用缓存或演示数字。</p>
            </div>
          ) : (
            <>
              {view === "dashboard" && (
                <>
                  <div className="welcome-card">
                    <div className="welcome-icon">
                      <Sparkles size={23} />
                    </div>
                    <div>
                      <h3>专注当下，让研究持续发生。</h3>
                      <p>
                        {store.projects.length
                          ? `你有 ${store.projects.filter((p) => p.status === "active").length} 个进行中的项目，今天也向目标靠近一点。`
                          : "欢迎来到你的科研空间。创建第一个项目，开启一段新的探索。"}
                      </p>
                    </div>
                    <button className="button" onClick={() => open("logs")}>
                      记录今天 <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="stats-grid">
                    {[
                      [
                        Clock,
                        "今日科研时长",
                        stats.todayHours.toFixed(1),
                        "小时",
                        "来自已记录日志",
                      ],
                      [
                        ChartNoAxesCombined,
                        "本周科研时长",
                        stats.weekHours.toFixed(1),
                        "小时",
                        "从本周一开始累计",
                      ],
                      [
                        Target,
                        "进行中的任务",
                        stats.active,
                        "项",
                        `本周完成 ${stats.weekDone} 项`,
                      ],
                      [
                        Flag,
                        "阶段目标完成率",
                        stats.stageProgress,
                        "%",
                        `${stats.streak} 天连续科研记录`,
                      ],
                    ].map(([Icon, label, value, unit, sub]) => {
                      const I = Icon as typeof Clock;
                      return (
                        <div className="stat-card" key={String(label)}>
                          <div className="stat-label">
                            {String(label)}
                            <I size={17} />
                          </div>
                          <div className="stat-value">
                            {String(value)}
                            <span>{String(unit)}</span>
                          </div>
                          <div className="stat-sub">{String(sub)}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="dashboard-grid">
                    <section className="panel today-panel">
                      <PanelTitle
                        title="今日任务"
                        subtitle="TODAY’S FOCUS"
                        action="全部任务"
                        onAction={() => {
                          go("goals");
                          setGoalKind("tasks");
                        }}
                      />
                      <div className="task-list">
                        {store.tasks
                          .filter(
                            (t) =>
                              t.status !== "archived" &&
                              t.date <= today &&
                              (!t.data.dueDate ||
                                String(t.data.dueDate) >= today),
                          )
                          .slice(0, 6)
                          .map((r) => (
                            <TaskRow
                              key={r.id}
                              r={r}
                              project={
                                store.projects.find(
                                  (p) => p.id === r.project_id,
                                )?.title
                              }
                              onOpen={() => open("tasks", r)}
                              toggle={() => toggle(r)}
                            />
                          ))}
                        {!store.tasks.some(
                          (t) =>
                            t.date <= today &&
                            (!t.data.dueDate ||
                              String(t.data.dueDate) >= today) &&
                            t.status !== "archived",
                        ) && (
                          <Empty
                            title="今天，想推进什么？"
                            text="将研究目标拆解成一个可完成的小任务。"
                            action="添加今日任务"
                            onClick={() => open("tasks")}
                          />
                        )}
                      </div>
                      <button
                        className="inline-add"
                        onClick={() => open("tasks")}
                      >
                        <Plus size={15} />
                        添加研究任务
                      </button>
                    </section>
                    <section className="panel quick-panel">
                      <PanelTitle title="快速记录" subtitle="CAPTURE AN IDEA" />
                      <p className="panel-description">让思考留下痕迹。</p>
                      {(
                        [
                          {
                            k: "logs",
                            icon: NotebookPen,
                            title: "写科研日志",
                            desc: "记录今天的工作与思考",
                          },
                          {
                            k: "experiments",
                            icon: FlaskConical,
                            title: "记录实验",
                            desc: "沉淀参数、结果与结论",
                          },
                          {
                            k: "achievements",
                            icon: Library,
                            title: "归档研究成果",
                            desc: "为阶段性的发现建立档案",
                          },
                        ] as const
                      ).map((x) => (
                        <button
                          className="quick-item"
                          key={x.k}
                          onClick={() => open(x.k)}
                        >
                          <span className={`quick-icon ${x.k}`}>
                            <x.icon size={19} />
                          </span>
                          <span>
                            {x.title}
                            <small>{x.desc}</small>
                          </span>
                          <ChevronRight size={16} />
                        </button>
                      ))}
                    </section>
                    <section className="panel projects-panel">
                      <PanelTitle
                        title="当前研究项目"
                        subtitle="WORK IN PROGRESS"
                        action="全部项目"
                        onAction={() => {
                          go("goals");
                          setGoalKind("projects");
                        }}
                      />
                      {store.projects
                        .filter((p) => p.status === "active")
                        .slice(0, 3)
                        .map((p) => (
                          <ProjectCard
                            key={p.id}
                            p={p}
                            store={store}
                            onClick={() => open("projects", p)}
                          />
                        ))}
                      {!store.projects.some((p) => p.status === "active") && (
                        <Empty
                          title="为下一个发现，建立项目"
                          text="项目会连接你的阶段目标、任务、实验和成果。"
                          action="新建研究项目"
                          onClick={() => open("projects")}
                        />
                      )}
                    </section>
                    <section className="panel activity-panel">
                      <PanelTitle
                        title="最近活动"
                        subtitle="RESEARCH IN MOTION"
                      />
                      {(["logs", "experiments", "achievements"] as Kind[])
                        .flatMap((k) => store[k].map((r) => ({ k, r })))
                        .sort((a, b) =>
                          b.r.updated_at.localeCompare(a.r.updated_at),
                        )
                        .slice(0, 5)
                        .map(({ k, r }) => (
                          <button
                            className="activity-row"
                            key={r.id}
                            onClick={() => open(k, r)}
                          >
                            <span className="activity-dot" />
                            <span>
                              <small>
                                {labels[k]} · {statuses[r.status]}
                              </small>
                              {r.title}
                              <time>
                                {new Date(r.updated_at).toLocaleDateString(
                                  "zh-CN",
                                )}
                              </time>
                            </span>
                            <ArrowUpRight size={14} />
                          </button>
                        ))}
                      {!store.logs.length &&
                        !store.experiments.length &&
                        !store.achievements.length && (
                          <div className="quiet-empty">
                            <Activity size={25} />
                            <p>你的科研轨迹，将从这里生长。</p>
                          </div>
                        )}
                    </section>
                  </div>
                  <section className="panel heatmap-panel">
                    <PanelTitle
                      title="科研活跃度"
                      subtitle="A LITTLE PROGRESS, EVERY DAY"
                    />
                    <Heatmap logs={store.logs} onDate={(d) => openLog(d)} />
                  </section>
                </>
              )}
              {["goals", "logs", "experiments", "achievements"].includes(
                view,
              ) && (
                <>
                  {view === "goals" && (
                    <div className="tabs">
                      {(["projects", "milestones", "tasks"] as Kind[]).map(
                        (k) => (
                          <button
                            key={k}
                            className={goalKind === k ? "active" : ""}
                            onClick={() => {
                              setGoalKind(k);
                              setMode("list");
                            }}
                          >
                            {labels[k]}
                            <small>{store[k].length}</small>
                          </button>
                        ),
                      )}
                    </div>
                  )}
                  <div className="list-toolbar">
                    <div className="row wrap">
                      <select
                        aria-label="项目筛选"
                        value={filterProject}
                        onChange={(e) => setFilterProject(e.target.value)}
                      >
                        <option value="">全部项目</option>
                        {store.projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="状态筛选"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                      >
                        <option value="">全部状态</option>
                        {Object.entries(statuses).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      {kind === "tasks" && (
                        <select
                          aria-label="优先级筛选"
                          value={priority}
                          onChange={(e) => setPriority(e.target.value)}
                        >
                          <option value="">全部优先级</option>
                          {["高", "中", "低"].map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </select>
                      )}
                      {kind === "achievements" && (
                        <select
                          aria-label="成果类型筛选"
                          value={type}
                          onChange={(e) => setType(e.target.value)}
                        >
                          <option value="">全部类型</option>
                          {[
                            "理论研究",
                            "算法开发",
                            "仿真实验",
                            "技术报告",
                            "论文与学术成果",
                            "阶段总结",
                            "其他",
                          ].map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      )}
                      {kind === "achievements" && (
                        <select
                          aria-label="阶段筛选"
                          value={stage}
                          onChange={(e) => setStage(e.target.value)}
                        >
                          <option value="">全部阶段</option>
                          {store.milestones
                            .filter(
                              (m) =>
                                !filterProject ||
                                m.project_id === filterProject,
                            )
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.title}
                              </option>
                            ))}
                        </select>
                      )}
                      <input
                        type="date"
                        aria-label="开始日期筛选"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                      <span className="muted">—</span>
                      <input
                        type="date"
                        aria-label="结束日期筛选"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </div>
                    <div className="segmented">
                      <button
                        className={mode === "list" ? "active" : ""}
                        title="列表视图"
                        aria-label="列表视图"
                        onClick={() => setMode("list")}
                      >
                        <List size={16} />
                      </button>
                      <button
                        className={mode !== "list" ? "active" : ""}
                        title={
                          kind === "logs"
                            ? "月历视图"
                            : kind === "tasks"
                              ? "看板视图"
                              : "卡片视图"
                        }
                        aria-label="切换卡片或日历视图"
                        onClick={() =>
                          setMode(kind === "logs" ? "calendar" : "cards")
                        }
                      >
                        {kind === "logs" ? (
                          <CalendarDays size={16} />
                        ) : (
                          <LayoutGrid size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                  {kind === "logs" && mode === "calendar" ? (
                    <Calendar logs={filtered} onDate={openLog} />
                  ) : kind === "tasks" && mode === "cards" ? (
                    <div className="kanban">
                      {["planned", "active", "done", "paused"].map((s) => (
                        <section key={s}>
                          <h3>
                            <span className={`status-dot ${s}`} />
                            {statuses[s]}{" "}
                            <small>
                              {filtered.filter((r) => r.status === s).length}
                            </small>
                          </h3>
                          {filtered
                            .filter((r) => r.status === s)
                            .map((r) => (
                              <div className="kanban-card" key={r.id}>
                                <TaskRow
                                  r={r}
                                  onOpen={() => open(kind, r)}
                                  toggle={() => toggle(r)}
                                />
                                <select
                                  aria-label="修改任务状态"
                                  value={r.status}
                                  onChange={async (e) => {
                                    try {
                                      await api(`/api/records/tasks/${r.id}`, {
                                        method: "PUT",
                                        body: JSON.stringify({
                                          ...toInput(r),
                                          status: e.target.value,
                                        }),
                                      });
                                      await load();
                                    } catch (e) {
                                      setToast((e as Error).message);
                                    }
                                  }}
                                >
                                  {["planned", "active", "done", "paused"].map(
                                    (s) => (
                                      <option key={s} value={s}>
                                        {statuses[s]}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </div>
                            ))}
                          <button
                            className="inline-add"
                            onClick={() => open("tasks")}
                          >
                            <Plus size={15} />
                            添加任务
                          </button>
                        </section>
                      ))}
                    </div>
                  ) : !filtered.length ? (
                    <section className="panel">
                      <Empty
                        title={`还没有${labels[kind]}`}
                        text="每一条真实记录，都会让你的研究更清晰。"
                        action={`创建${labels[kind]}`}
                        onClick={() => open(kind)}
                      />
                    </section>
                  ) : (
                    <div
                      className={
                        mode === "cards"
                          ? "record-cards"
                          : "panel records-panel"
                      }
                    >
                      {filtered.map((r) =>
                        kind === "projects" ? (
                          <ProjectCard
                            key={r.id}
                            p={r}
                            store={store}
                            onClick={() => open(kind, r)}
                          />
                        ) : kind === "tasks" ? (
                          <TaskRow
                            key={r.id}
                            r={r}
                            project={
                              store.projects.find((p) => p.id === r.project_id)
                                ?.title
                            }
                            toggle={() => toggle(r)}
                            onOpen={() => open(kind, r)}
                          />
                        ) : (
                          <div className="record-row" key={r.id}>
                            {kind === "experiments" && (
                              <input
                                aria-label={`对比 ${r.title}`}
                                type="checkbox"
                                checked={compare.includes(r.id)}
                                onChange={(e) =>
                                  setCompare((p) =>
                                    e.target.checked
                                      ? [...p, r.id]
                                      : p.filter((x) => x !== r.id),
                                  )
                                }
                              />
                            )}
                            <span className={`record-icon ${kind}`}>
                              {kind === "experiments" ? (
                                <FlaskConical size={20} />
                              ) : kind === "achievements" ? (
                                <Library size={20} />
                              ) : kind === "milestones" ? (
                                <Flag size={20} />
                              ) : (
                                <NotebookPen size={20} />
                              )}
                            </span>
                            <button
                              className="record-main"
                              onClick={() => open(kind, r)}
                            >
                              <strong>{r.title}</strong>
                              <p>
                                {String(
                                  r.data.summary ||
                                    r.data.description ||
                                    r.data.purpose ||
                                    r.data.work ||
                                    "点击查看详情",
                                )}
                              </p>
                              <small>
                                {r.date} <span>·</span>{" "}
                                {store.projects.find(
                                  (p) => p.id === r.project_id,
                                )?.title || "未关联项目"}
                                {kind === "experiments" &&
                                  ` · EXP-${r.id.slice(0, 8).toUpperCase()}`}
                              </small>
                              {kind === "milestones" && (
                                <Progress
                                  value={progress(
                                    store.tasks.filter(
                                      (t) => t.milestone_id === r.id,
                                    ),
                                  )}
                                />
                              )}
                            </button>
                            <span className={`badge ${r.status}`}>
                              {statuses[r.status]}
                            </span>
                            <ChevronRight className="muted" size={15} />
                          </div>
                        ),
                      )}
                    </div>
                  )}
                  {kind === "experiments" && compare.length > 0 && (
                    <section className="panel comparison">
                      <PanelTitle title="实验指标对比" />
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>自定义指标</th>
                              {store.experiments
                                .filter((e) => compare.includes(e.id))
                                .map((e) => (
                                  <th key={e.id}>{e.title}</th>
                                ))}
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              ...new Set(
                                store.experiments
                                  .filter((e) => compare.includes(e.id))
                                  .flatMap((e) => Object.keys(parseMetrics(e))),
                              ),
                            ].map((metric) => (
                              <tr key={metric}>
                                <th>{metric}</th>
                                {store.experiments
                                  .filter((e) => compare.includes(e.id))
                                  .map((e) => (
                                    <td key={e.id}>
                                      {String(parseMetrics(e)[metric] ?? "—")}
                                    </td>
                                  ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="hint">
                        勾选至少两条实验比较；指标来自记录中的自定义 JSON。
                      </p>
                    </section>
                  )}
                </>
              )}
              {view === "stats" && (
                <Stats store={store} open={open} openLog={openLog} />
              )}
              {view === "data" && (
                <DataManagement store={store} reload={load} notify={setToast} />
              )}
              {view === "settings" && (
                <div className="settings-grid">
                  <section className="panel settings-card">
                    <h3>外观设置</h3>
                    <p>选择适合你工作环境的主题。</p>
                    <button className="button" onClick={theme}>
                      {dark ? <Sun size={16} /> : <Moon size={16} />}切换为
                      {dark ? "浅色" : "深色"}主题
                    </button>
                    <p className="hint">主题偏好保存在当前设备。</p>
                  </section>
                  <section className="panel settings-card">
                    <h3>账户与隐私</h3>
                    <p>{email}</p>
                    <p>
                      <ShieldCheck size={16} /> 私人工作空间 ·
                      服务端身份与所有权验证
                    </p>
                    <a
                      className="button"
                      href="/signout-with-chatgpt?return_to=/"
                      target="_top"
                    >
                      <LogOut size={16} />
                      退出登录
                    </a>
                  </section>
                  <section className="panel settings-card">
                    <h3>关于 Research OS</h3>
                    <p>V1.0 · 为持续探索而设计</p>
                    <p>
                      统计日期以北京时间为准；科研时长来自已提交的日志，计时结束后合并到日志，可手动修正。
                    </p>
                    <button className="button" onClick={() => go("data")}>
                      管理与备份数据
                      <ArrowUpRight size={15} />
                    </button>
                  </section>
                </div>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <span className="green-dot" />
              Research OS · 私人科研工作台
            </span>
            <span>Stay curious. Keep exploring.</span>
          </footer>
        </main>
      </div>
      {selection && (
        <Editor
          key={`${selection.kind}-${selection.record?.id || "new"}-${selection.date || ""}`}
          kind={selection.kind}
          record={selection.record}
          initialDate={selection.date}
          store={store}
          onClose={close}
          onSaved={load}
          onNavigate={(k, r) => open(k, r)}
        />
      )}{" "}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
  function openLog(date: string) {
    const existing = store.logs.find((l) => l.date === date);
    open("logs", existing, date);
  }
}
function parseMetrics(r: ResearchRecord): Record<string, unknown> {
  try {
    return JSON.parse(String(r.data.metrics || "{}"));
  } catch {
    return {};
  }
}
