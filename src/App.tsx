import { useEffect, useMemo, useState } from "react";
import { downloadCsv, downloadXlsx } from "./export";
import { filterJobs, formatDateTime, sortJobs, sourceLabel, STATUS_LABELS } from "./job-utils";
import type { Filters, JobDataset, JobRecord, SearchConfig, SortKey } from "./types";

const PAGE_SIZE = 10;

const initialFilters: Filters = {
  query: "",
  city: "all",
  source: "all",
  status: "all",
  minimumSalaryK: 0,
};

function App() {
  const [dataset, setDataset] = useState<JobDataset | null>(null);
  const [config, setConfig] = useState<SearchConfig | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [sortKey, setSortKey] = useState<SortKey>("latest");
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<JobRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/jobs.json`).then((response) => {
        if (!response.ok) throw new Error("岗位数据加载失败");
        return response.json() as Promise<JobDataset>;
      }),
      fetch(`${base}data/config.json`).then((response) => {
        if (!response.ok) throw new Error("采集配置加载失败");
        return response.json() as Promise<SearchConfig>;
      }),
    ])
      .then(([jobData, searchConfig]) => {
        setDataset(jobData);
        setConfig(searchConfig);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "页面加载失败");
      });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters, sortKey]);

  const filteredJobs = useMemo(() => {
    if (!dataset) return [];
    return sortJobs(filterJobs(dataset.jobs, filters), sortKey);
  }, [dataset, filters, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const visibleJobs = filteredJobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const stats = useMemo(() => {
    const jobs = dataset?.jobs ?? [];
    return {
      total: jobs.length,
      newCount: jobs.filter((job) => job.status === "new").length,
      officialCount: jobs.filter((job) => job.sources.some((source) => source.type === "official")).length,
      companyCount: new Set(jobs.map((job) => job.company)).size,
    };
  }, [dataset]);

  if (error) {
    return (
      <main className="state-page">
        <p className="eyebrow">SEARCH FOR JOB</p>
        <h1>页面暂时无法加载</h1>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>重新加载</button>
      </main>
    );
  }

  if (!dataset || !config) {
    return (
      <main className="state-page">
        <div className="loader" aria-label="正在加载" />
        <p>正在整理岗位数据…</p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="岗位看板首页">
          <span className="brand-mark">寻</span>
          <span>成都产品岗位</span>
        </a>
        <div className="header-status">
          <span className="live-dot" />
          工作日 {config.schedule.time} 更新
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">CHENGDU · PRODUCT ROLES</p>
            <h1>把分散的岗位，<br />收进一张清晰的表。</h1>
            <p className="hero-description">
              聚合 Boss 直聘与公司官网，统一整理成都地区、100 人以上公司，且全职、本科及以上、
              月薪下限 10K 及以上的产品经理岗位。
            </p>
            <div className="hero-meta">
              <span>最近更新 {formatDateTime(dataset.generatedAt)}</span>
              <span>·</span>
              <span>{config.keywords.length} 个岗位关键词</span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="hero-number">{stats.total}</div>
            <div className="hero-number-label">个在库岗位</div>
          </div>
        </section>

        {dataset.isDemo && (
          <div className="demo-banner" role="status">
            <strong>当前为 v0.1.0 示例数据</strong>
            <span>用于验证页面、筛选和下载；自动采集将在后续版本接入。</span>
          </div>
        )}

        <section className="stats-grid" aria-label="岗位概览">
          <article><span>全部岗位</span><strong>{stats.total}</strong><small>结构化记录</small></article>
          <article><span>今日新增</span><strong>{stats.newCount}</strong><small>等待你查看</small></article>
          <article><span>覆盖公司</span><strong>{stats.companyCount}</strong><small>规模 100 人以上</small></article>
          <article><span>官网岗位</span><strong>{stats.officialCount}</strong><small>包含原始链接</small></article>
        </section>

        <section className="workspace">
          <div className="section-heading">
            <div>
              <p className="eyebrow">JOB BOARD</p>
              <h2>岗位列表</h2>
            </div>
            <div className="download-actions">
              <button className="button-secondary" onClick={() => downloadCsv(dataset.jobs)}>
                下载全部 CSV
              </button>
              <button className="button-primary" onClick={() => void downloadXlsx(filteredJobs)} disabled={!filteredJobs.length}>
                下载筛选结果 Excel
              </button>
            </div>
          </div>

          <div className="filters">
            <label className="search-field">
              <span>搜索</span>
              <input
                type="search"
                placeholder="公司、岗位或描述关键词"
                value={filters.query}
                onChange={(event) => setFilters({ ...filters, query: event.target.value })}
              />
            </label>
            <label>
              <span>城市</span>
              <select value={filters.city} onChange={(event) => setFilters({ ...filters, city: event.target.value })}>
                <option value="all">全部城市</option>
                {config.cities.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
            </label>
            <label>
              <span>来源</span>
              <select value={filters.source} onChange={(event) => setFilters({ ...filters, source: event.target.value as Filters["source"] })}>
                <option value="all">全部来源</option>
                <option value="boss">Boss直聘</option>
                <option value="official">公司官网</option>
              </select>
            </label>
            <label>
              <span>状态</span>
              <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as Filters["status"] })}>
                <option value="all">全部状态</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>最低月薪</span>
              <select value={filters.minimumSalaryK} onChange={(event) => setFilters({ ...filters, minimumSalaryK: Number(event.target.value) })}>
                <option value={0}>不限</option>
                <option value={10}>10K+</option>
                <option value={15}>15K+</option>
                <option value={20}>20K+</option>
                <option value={25}>25K+</option>
              </select>
            </label>
            <label>
              <span>排序</span>
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                <option value="latest">最新发现</option>
                <option value="salaryDesc">薪资从高到低</option>
                <option value="company">公司名称</option>
              </select>
            </label>
          </div>

          <div className="result-summary">
            <span>找到 <strong>{filteredJobs.length}</strong> 个岗位</span>
            {(filters.query || filters.city !== "all" || filters.source !== "all" || filters.status !== "all" || filters.minimumSalaryK > 0) && (
              <button className="text-button" onClick={() => setFilters(initialFilters)}>清除筛选</button>
            )}
          </div>

          <div className="job-table" role="table" aria-label="岗位列表">
            <div className="job-row job-table-header" role="row">
              <span>公司 / 规模</span>
              <span>岗位</span>
              <span>薪资</span>
              <span>来源</span>
              <span>状态</span>
              <span aria-hidden="true" />
            </div>
            {visibleJobs.map((job) => (
              <article className="job-row" role="row" key={job.id}>
                <div className="company-cell">
                  <strong>{job.company}</strong>
                  <span>{job.companySize} · {job.city}</span>
                </div>
                <div className="title-cell">
                  <strong>{job.title}</strong>
                  <span>{job.description}</span>
                </div>
                <strong className="salary-cell">{job.salary}</strong>
                <div className="source-list">
                  {job.sources.map((source) => (
                    source.url ? <a key={`${job.id}-${source.name}`} href={source.url} target="_blank" rel="noreferrer">{source.name}</a> : <span key={`${job.id}-${source.name}`}>{source.name}</span>
                  ))}
                </div>
                <span className={`status-badge status-${job.status}`}>{STATUS_LABELS[job.status]}</span>
                <button className="detail-button" onClick={() => setSelectedJob(job)} aria-label={`查看${job.title}详情`}>查看</button>
              </article>
            ))}
            {!visibleJobs.length && (
              <div className="empty-state">
                <strong>没有找到匹配的岗位</strong>
                <span>试试调整关键词或清除筛选条件。</span>
              </div>
            )}
          </div>

          {pageCount > 1 && (
            <nav className="pagination" aria-label="分页">
              <button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>上一页</button>
              <span>{page} / {pageCount}</span>
              <button disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>下一页</button>
            </nav>
          )}
        </section>
      </main>

      <footer>
        <span>Search for Job · 公开岗位信息看板</span>
        <span>数据仅供求职参考，请以原始招聘页面为准</span>
      </footer>

      {selectedJob && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelectedJob(null)}>
          <section className="job-modal" role="dialog" aria-modal="true" aria-labelledby="job-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedJob(null)} aria-label="关闭">×</button>
            <p className="eyebrow">{selectedJob.company} · {selectedJob.companySize}</p>
            <h2 id="job-modal-title">{selectedJob.title}</h2>
            <div className="modal-meta">
              <strong>{selectedJob.salary}</strong>
              <span>{selectedJob.city}</span>
              <span>{sourceLabel(selectedJob)}</span>
            </div>
            <h3>岗位描述</h3>
            <p className="job-description">{selectedJob.description}</p>
            <div className="modal-links">
              {selectedJob.sources.filter((source) => source.url).map((source) => (
                <a className="button-primary" key={source.name} href={source.url} target="_blank" rel="noreferrer">
                  打开{source.name}
                </a>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
