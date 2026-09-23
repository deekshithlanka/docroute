/**
 * Stand-in for the ERP's job master. In a real deployment this would be a
 * lookup against the ERP API (or a nightly sync into Postgres).
 */
export interface Job {
  job_number: string;
  name: string;
  project_manager: string;
  status: "active" | "closed";
}

export const JOBS: Job[] = [
  { job_number: "24-1187", name: "Westpark Medical Office Building", project_manager: "D. Alvarez", status: "active" },
  { job_number: "24-1203", name: "Harbor Point Data Center Ph. 2", project_manager: "K. Nguyen", status: "active" },
  { job_number: "24-1215", name: "Lakeview Elementary Modernization", project_manager: "S. Patel", status: "active" },
  { job_number: "25-0042", name: "Riverbend Water Treatment Upgrade", project_manager: "M. Okafor", status: "active" },
  { job_number: "23-0910", name: "Oak Terrace Parking Structure", project_manager: "D. Alvarez", status: "closed" },
];

export function findJob(jobNumber: string | null | undefined): Job | undefined {
  if (!jobNumber) return undefined;
  const norm = jobNumber.trim().replace(/^#/, "").toUpperCase();
  return JOBS.find((j) => j.job_number.toUpperCase() === norm);
}
