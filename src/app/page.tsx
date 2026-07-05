import { ArrowRight, CheckCircle2, LayoutGrid, Printer, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

const seats = [
  "张浩",
  "李萌",
  "王宇",
  "陈欣",
  "赵磊",
  "孙悦",
  "周睿",
  "吴佳",
  "徐诺",
  "何晴",
  "罗一",
  "郭琳"
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-paper">
      <section className="mx-auto grid min-h-screen max-w-[1280px] content-center gap-8 px-5 py-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(460px,1.05fr)] lg:px-8">
        <div className="flex flex-col justify-center">
          <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-[8px] border border-fern/20 bg-white px-3 py-2 text-sm font-bold text-fern shadow-sm">
            <Sparkles className="h-4 w-4" />
            SeatWise MVP
          </div>
          <h1 className="text-4xl font-black tracking-normal text-ink sm:text-5xl">SeatWise 智能排座位助手</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-ink/68">
            面向中国中小学班主任，基于视力、身高、同桌关系和公平轮换生成可解释的班级座位表。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/workspace"
              className="flex items-center gap-2 rounded-[8px] bg-fern px-5 py-3 font-bold text-white shadow-sm hover:bg-fern/90"
            >
              开始使用
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="flex items-center gap-2 rounded-[8px] border border-ink/10 bg-white px-5 py-3 font-bold text-ink hover:bg-chalk"
            >
              查看能力
            </a>
          </div>
          <div id="features" className="mt-8 grid gap-3 sm:grid-cols-3">
            <Feature icon={LayoutGrid} label="规则生成" />
            <Feature icon={ShieldCheck} label="隐私视图" />
            <Feature icon={Printer} label="打印导出" />
          </div>
        </div>

        <div className="rounded-[8px] border border-ink/10 bg-white p-4 shadow-soft">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-fern">三年级 2 班</div>
              <div className="mt-1 text-2xl font-black text-ink">方案 A · 92 分</div>
            </div>
            <span className="rounded-[6px] bg-coral/10 px-3 py-1.5 text-sm font-bold text-coral">2 条复核</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {seats.map((name, index) => (
              <div key={name} className="min-h-[92px] rounded-[8px] border border-ink/10 bg-paper p-2">
                <div className="text-[11px] font-bold text-ink/45">
                  {Math.floor(index / 4) + 1}-{(index % 4) + 1}
                </div>
                <div className="mt-3 truncate text-sm font-black text-ink">{name}</div>
                {index % 3 === 0 ? (
                  <div className="mt-2 inline-flex rounded-[4px] bg-chalk px-1.5 py-0.5 text-[10px] font-bold text-fern">
                    视力
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {["视力照顾 96", "纪律风险 88", "公平轮换 91"].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-[8px] bg-chalk p-3 text-sm font-bold text-ink/70">
                <CheckCircle2 className="h-4 w-4 text-fern" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Feature({ icon: Icon, label }: { icon: typeof LayoutGrid; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[8px] border border-ink/10 bg-white p-3 font-bold text-ink shadow-sm">
      <Icon className="h-4 w-4 text-fern" />
      {label}
    </div>
  );
}
