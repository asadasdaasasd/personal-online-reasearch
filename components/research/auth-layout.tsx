import {
  Activity,
  ArrowUpRight,
  FlaskConical,
  NotebookPen,
  ShieldCheck,
} from "lucide-react";
import { QuickEntry } from "./quick-entry";
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Activity size={22} />
          </span>
          <span>
            Research OS<small>个人科研工作台</small>
          </span>
        </a>
        <div className="auth-story-body">
          <span className="auth-eyebrow">A LITTLE PROGRESS, EVERY DAY</span>
          <h2>
            让每一次探索，
            <br />
            都有迹可循<span>。</span>
          </h2>
          <p>
            把目标、实验与发现连接起来。
            <br />
            为长久的研究，留下一份清晰的记录。
          </p>
          <div className="auth-story-cards">
            <div>
              <NotebookPen size={18} />
              <span>
                记录今天的进展<small>从一个问题、一段思考开始</small>
              </span>
              <ArrowUpRight size={16} />
            </div>
            <div>
              <FlaskConical size={18} />
              <span>
                保留每一次尝试<small>让实验、参数和结果可以复现</small>
              </span>
              <ArrowUpRight size={16} />
            </div>
          </div>
        </div>
        <div className="auth-story-footer">
          <ShieldCheck size={16} /> 账户验证 · 私人资料 · 云端保存
        </div>
      </section>
      <section className="auth-right">
        <div className="auth-right-content">
          {children}
          <QuickEntry />
        </div>
        <footer>Stay curious. Keep exploring.</footer>
      </section>
    </main>
  );
}
