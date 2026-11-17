/**
 * Made-up candidates and roles for trying the candidate list and matching. Nobody here is real.
 * Eight kinds of data person, three of each at different levels, in different places and
 * company sizes, with different amounts known about them. The junior of each trio has only a
 * LinkedIn profile on file, so the "what is missing" view has something to show.
 */
import type { DimensionKey, Profile, Source } from "../core/candidate-schema";
import type { Requirements } from "../core/matching";

type Skill = [name: string, category: Profile["skills"][number]["category"], share: number];
type Kind = {
  titles: [string, string, string]; headline: string; skills: Skill[]; industries: string[]; certs: string[];
  now: string[]; before: string[]; wins: string[]; targetRoles: string[];
};

const KINDS: Kind[] = [
  { // 0 Analytics engineer, Azure + Snowflake
    titles: ["Analytics Engineer", "Senior Analytics Engineer", "Lead Analytics Engineer"], headline: "Analytics engineer on Snowflake, dbt and Azure",
    skills: [["Snowflake", "warehouse", 0.7], ["dbt", "transformation", 0.6], ["SQL", "language", 1], ["Azure", "cloud", 0.7], ["Azure Data Factory", "orchestration", 0.5], ["Power BI", "bi", 0.5], ["Python", "language", 0.4]],
    industries: ["insurance", "financial services"], certs: ["SnowPro Core", "dbt Analytics Engineering"], targetRoles: ["Analytics Engineer", "Senior Analytics Engineer"],
    now: ["Owns the dbt project that models policy, claims and premium data in Snowflake for finance and actuarial teams.", "Builds Azure Data Factory pipelines that land source data in Snowflake each night.", "Defines metrics with finance and keeps one agreed definition of each in the semantic layer.", "Reviews pull requests and sets the modeling and testing standards for the analytics team."],
    before: ["Wrote SQL transformations and Power BI datasets for underwriting reports.", "Moved reporting logic out of stored procedures into tested dbt models."],
    wins: ["Cut the month-end reporting close from five days to two by replacing spreadsheet steps with dbt models.", "Reduced Snowflake spend by about 30% by reworking the largest models to build incrementally."] },
  { // 1 Data engineer, AWS + Databricks
    titles: ["Data Engineer", "Senior Data Engineer", "Staff Data Engineer"], headline: "Data engineer building Spark pipelines on AWS and Databricks",
    skills: [["Databricks", "processing", 0.6], ["Spark", "processing", 0.7], ["Python", "language", 1], ["AWS", "cloud", 0.8], ["Delta Lake", "warehouse", 0.5], ["Airflow", "orchestration", 0.6], ["SQL", "language", 0.9], ["Terraform", "other", 0.3]],
    industries: ["retail", "e-commerce"], certs: ["Databricks Certified Data Engineer Professional", "AWS Solutions Architect Associate"], targetRoles: ["Senior Data Engineer", "Staff Data Engineer"],
    now: ["Builds and runs PySpark pipelines on Databricks that process order, inventory and clickstream data into Delta Lake tables.", "Designs the medallion layout (raw, cleaned, business) and the data quality checks between layers.", "Schedules and monitors jobs in Airflow and is on call for the nightly loads.", "Works with data scientists to make feature tables available for demand forecasting."],
    before: ["Maintained Python ETL jobs on AWS (S3, Glue, Lambda) feeding a Redshift warehouse.", "Migrated legacy Hive jobs to Spark."],
    wins: ["Brought the nightly inventory load from six hours to 50 minutes by repartitioning and removing wide shuffles.", "Led the migration of 140 pipelines from EMR to Databricks with no missed loads."] },
  { // 2 BI developer, Power BI + SQL Server
    titles: ["BI Developer", "Senior BI Developer", "BI Manager"], headline: "BI developer: Power BI, DAX and SQL Server",
    skills: [["Power BI", "bi", 0.9], ["SQL Server", "warehouse", 0.9], ["SQL", "language", 1], ["Azure Synapse", "warehouse", 0.3], ["Tableau", "bi", 0.2], ["Python", "language", 0.2]],
    industries: ["banking", "healthcare"], certs: ["Microsoft Certified: Power BI Data Analyst Associate"], targetRoles: ["BI Developer", "Senior BI Developer", "Analytics Manager"],
    now: ["Designs Power BI datasets and reports used by branch managers and the executive team.", "Writes DAX measures and keeps the shared dataset fast as it grows.", "Gathers requirements directly from business users and turns them into report specifications.", "Maintains SSIS packages and SQL Server views that feed the reporting layer."],
    before: ["Built operational reports in SSRS and Excel for a regional health system.", "Supported ad hoc data requests from finance and operations."],
    wins: ["Replaced 60 emailed spreadsheets with one set of Power BI dashboards used by 300 people each week.", "Trained 25 business users to build their own reports on the governed dataset."] },
  { // 3 Data engineer, GCP + BigQuery (startup flavoured)
    titles: ["Data Engineer", "Senior Data Engineer", "Founding Data Engineer"], headline: "Data engineer on GCP: BigQuery, dbt and Airflow",
    skills: [["BigQuery", "warehouse", 0.8], ["dbt", "transformation", 0.6], ["Airflow", "orchestration", 0.7], ["Python", "language", 1], ["GCP", "cloud", 0.8], ["SQL", "language", 1], ["Fivetran", "other", 0.4], ["Looker", "bi", 0.4]],
    industries: ["B2B SaaS", "fintech"], certs: ["Google Cloud Professional Data Engineer"], targetRoles: ["Senior Data Engineer", "Analytics Engineer", "Head of Data"],
    now: ["Built the company's data stack from nothing: Fivetran and custom Python loaders into BigQuery, dbt for modeling, Looker on top.", "Is the only data engineer, so decides what to build, talks to every team and ships it.", "Runs Airflow on Cloud Composer and keeps the pipelines cheap and observable.", "Sets up event tracking with product and engineering and owns the resulting tables."],
    before: ["Wrote Python and SQL pipelines at a larger SaaS company on a team of eight.", "Maintained Looker explores and the LookML project."],
    wins: ["Stood up a working warehouse and the first board metrics in six weeks.", "Cut the BigQuery bill in half by partitioning event tables and removing unused scheduled queries."] },
  { // 4 Data platform / streaming
    titles: ["Data Platform Engineer", "Senior Data Platform Engineer", "Data Platform Lead"], headline: "Data platform engineer: Kafka, Spark, Kubernetes on AWS",
    skills: [["Kafka", "streaming", 0.7], ["Spark", "processing", 0.7], ["Scala", "language", 0.5], ["Python", "language", 0.9], ["AWS", "cloud", 0.9], ["Kubernetes", "other", 0.6], ["Terraform", "other", 0.6], ["Flink", "streaming", 0.3], ["Airflow", "orchestration", 0.5]],
    industries: ["logistics", "payments"], certs: ["AWS Solutions Architect Professional", "Confluent Certified Developer"], targetRoles: ["Data Platform Lead", "Staff Data Engineer", "Engineering Manager, Data"],
    now: ["Leads the team that runs the streaming platform: Kafka, Spark Structured Streaming and the services around them.", "Designs how shipment and tracking events flow from operational systems to the lake in near real time.", "Owns the infrastructure as code (Terraform, Kubernetes) and the platform's cost and reliability targets.", "Mentors engineers and sets the technical direction with the director of engineering."],
    before: ["Built batch and streaming pipelines in Scala and Spark for a payments processor.", "Was on call for a Kafka cluster handling two billion messages a day."],
    wins: ["Took tracking-event latency from 15 minutes to under 30 seconds by moving from batch to streaming.", "Cut platform incidents by 60% in a year through alerting, runbooks and capacity planning."] },
  { // 5 Analyst turned analytics engineer (small company, generalist)
    titles: ["Data Analyst", "Senior Data Analyst", "Analytics Lead"], headline: "Analyst who models data: SQL, dbt, Looker and Tableau",
    skills: [["SQL", "language", 1], ["Tableau", "bi", 0.6], ["Looker", "bi", 0.5], ["dbt", "transformation", 0.4], ["Snowflake", "warehouse", 0.4], ["Python", "language", 0.5], ["BigQuery", "warehouse", 0.3]],
    industries: ["hospitality", "consumer apps"], certs: ["Tableau Desktop Specialist"], targetRoles: ["Analytics Engineer", "Senior Data Analyst"],
    now: ["Answers business questions for marketing and operations and turns the repeated ones into dashboards.", "Started and now maintains the company's dbt project so analysts stop rewriting the same SQL.", "Runs pricing and promotion experiments and reports the results to leadership.", "Is the first person non-technical teams come to with a data question."],
    before: ["Built Tableau dashboards and weekly reports for a hotel group's revenue team.", "Cleaned and reconciled booking data from several property systems."],
    wins: ["Found a pricing error that was costing about $400k a year and got it fixed.", "Moved the team from one-off SQL to shared dbt models, halving time spent on recurring requests."] },
  { // 6 Data scientist
    titles: ["Data Scientist", "Senior Data Scientist", "Lead Data Scientist"], headline: "Data scientist: forecasting and causal analysis in Python",
    skills: [["Python", "language", 1], ["SQL", "language", 0.9], ["scikit-learn", "ml", 0.8], ["Databricks", "processing", 0.4], ["MLflow", "ml", 0.4], ["Snowflake", "warehouse", 0.4], ["Tableau", "bi", 0.3]],
    industries: ["healthcare technology", "insurance"], certs: [], targetRoles: ["Senior Data Scientist", "Lead Data Scientist"],
    now: ["Builds and maintains forecasting and risk models used by the operations and pricing teams.", "Designs experiments and causal analyses to measure what product and outreach changes do.", "Works with data engineers to put models into scheduled production jobs and monitor drift.", "Explains results to clinical and business leaders who are not statisticians."],
    before: ["Did statistical analysis and reporting on claims data.", "Prototyped churn and propensity models in notebooks."],
    wins: ["A no-show prediction model cut missed appointments by 18% across 40 clinics.", "Showed that a costly outreach program had no measurable effect, saving its budget."] },
  { // 7 Data engineering manager / enterprise Azure
    titles: ["Data Engineer", "Data Engineering Manager", "Director of Data Engineering"], headline: "Data engineering leader on Azure: Databricks, Synapse and Data Factory",
    skills: [["Azure", "cloud", 0.9], ["Databricks", "processing", 0.6], ["Azure Data Factory", "orchestration", 0.7], ["Azure Synapse", "warehouse", 0.5], ["Spark", "processing", 0.5], ["SQL", "language", 1], ["Python", "language", 0.7], ["Power BI", "bi", 0.3]],
    industries: ["manufacturing", "energy"], certs: ["Microsoft Certified: Azure Data Engineer Associate"], targetRoles: ["Data Engineering Manager", "Director of Data Engineering", "Senior Data Engineer"],
    now: ["Manages a team of data engineers building the enterprise lakehouse on Azure Databricks.", "Plans the roadmap with plant operations, finance and IT, and reports progress to the CIO.", "Sets standards for pipelines, access and data quality across business units.", "Hires, coaches and reviews the team, and manages two vendor relationships."],
    before: ["Built Data Factory and Synapse pipelines pulling from SAP and plant historians.", "Supported the move from on-premises SQL Server to Azure."],
    wins: ["Consolidated 11 plant-level reporting systems into one lakehouse over 18 months.", "Grew the team from three to nine while keeping attrition at zero for two years."] },
];

const NAMES = ["Anika Shah", "Jordan Reyes", "Mei Tanaka", "Tomás Herrera", "Rachel Kim", "Devon Clarke", "Sofia Petrov", "Malik Johnson", "Hye-jin Lee", "Chris Novak", "Fatima Aziz", "Owen Gallagher",
  "Lucia Romano", "Ethan Brooks", "Zara Ahmed", "Noah Stein", "Priyanka Desai", "Marcus Oyelaran", "Elena Vasquez", "Samir Haddad", "Grace Whitlock", "Tobias Lindgren", "Aaliyah Brooks", "Kenji Morita"];
const PLACES: [string, string][] = [["Hartford", "CT"], ["Chicago", "IL"], ["Austin", "TX"], ["Columbus", "OH"], ["Norfolk", "VA"], ["Denver", "CO"], ["Nashville", "TN"], ["Seattle", "WA"], ["Atlanta", "GA"], ["Minneapolis", "MN"], ["Raleigh", "NC"], ["Phoenix", "AZ"]];
const EMPLOYERS = ["Cedarline", "Harbor & Finch", "Northgate Group", "Pinecrest", "Bluewave", "Tallgrass", "Lumen", "Ironwood", "Sable", "Kestrel", "Marlow", "Quarry"];
// What they are like to work with: [trait, how we know, what they want, what worries them, size they prefer]
const STYLES: [string, string, string, string, Profile["workStyle"]["prefersCompanySize"]][] = [
  ["Direct and organised; gives short, specific answers", "Answered every screen question in two or three sentences with an example", "Clear ownership of a system end to end", "Unclear priorities and constant re-planning", ["mid", "large"]],
  ["Builder who likes ambiguity and moving fast", "Described choosing tools and shipping the first version alone", "A small team where one person can change a lot", "Slow approval processes", ["startup", "small"]],
  ["Patient explainer; strong with non-technical people", "Walked through a model in plain language without being asked", "Work that business users rely on every day", "Being walled off from the people who use the data", ["small", "mid"]],
  ["Careful and process-minded; documents everything", "Talked about runbooks, reviews and testing before speed", "Stability, mature practices and a clear career ladder", "Being on call for systems with no tests", ["large", "enterprise"]],
  ["Natural lead; talks about the team's results before their own", "Used 'we' throughout and credited two colleagues by name", "Growing people and setting direction", "A role with no say in hiring or roadmap", ["mid", "large", "enterprise"]],
  ["Curious and self-taught; asks a lot of questions", "Asked about the data model and team setup before pay", "Learning a modern stack from strong engineers", "Being the only data person again", ["small", "mid"]],
];
// The same six styles on the personality scales (1 to 5), most telling scale first.
const STYLE_SCALES: [DimensionKey, number, string][][] = [
  [["structure", 4, "Asked how work is planned and reviewed before anything else"], ["demeanor", 4, "Businesslike throughout; no small talk"], ["confidence", 4, "Stated numbers and results without hedging"], ["pace", 3, "Describes a steady week with clear deadlines"]],
  [["scope", 1, "Chose the tools, built the pipelines and the dashboards alone"], ["structure", 1, "Said the best jobs had no tickets"], ["pace", 5, "Talks about shipping in days"], ["teamwork", 2, "Prefers to own a problem end to end"], ["confidence", 4, "Comfortable disagreeing with the interviewer"]],
  [["audience", 5, "Happiest describing work with branch managers and finance"], ["demeanor", 2, "Warm and quick to laugh"], ["teamwork", 5, "Talks about pairing and teaching"], ["pace", 2, "Values getting it right over getting it out"]],
  [["structure", 5, "Brought up runbooks, tests and review twice unprompted"], ["scope", 4, "Wants to go deep on the platform, not do dashboards"], ["pace", 2, "Wary of teams that are always on fire"], ["demeanor", 4, "Measured and precise"], ["confidence", 2, "Understates their own part in results"]],
  [["leadership", 5, "Wants to keep managing people"], ["teamwork", 5, "Used 'we' throughout"], ["confidence", 4, "Clear about what they would change"], ["audience", 4, "Presents to executives monthly"]],
  [["scope", 2, "Has done analysis, modeling and pipelines and likes the mix"], ["confidence", 2, "Says 'I think' a lot; undersells real results"], ["demeanor", 2, "Friendly and informal"], ["teamwork", 4, "Wants senior people to learn from"]],
];
const INTERESTS = [["trail running", "home espresso"], ["chess", "woodworking"], ["youth soccer coaching", "sci-fi novels"], ["cycling", "open-source side projects"], ["cooking", "board games"], ["hiking", "photography"]];

const SIZES_BY_LEVEL: Profile["experience"][number]["companySize"][][] = [["small", "mid"], ["mid", "large"], ["large", "enterprise"]];

export type SampleCandidate = { name: string; linkedinUrl: string; email?: string; phone?: string; consentNote?: string; profile: Profile; sources: { kind: Source; title: string; content: string }[] };

export function sampleCandidates(): SampleCandidate[] {
  const year = new Date().getFullYear();
  return KINDS.flatMap((k, ki) => [0, 1, 2].map((level) => {
    const i = ki * 3 + level, name = NAMES[i], first = name.split(" ")[0];
    const total = [3, 7, 12][level] + (ki % 3);
    const [city, state] = PLACES[(ki * 5 + level * 3) % PLACES.length];
    const style = STYLES[(ki + level * 2) % STYLES.length];
    // The startup-flavoured kind runs smaller; platform and management kinds run larger.
    const shift = ki === 3 || ki === 5 ? -1 : ki === 4 || ki === 7 ? 1 : 0;
    const sizeAt = (n: number) => (["startup", "small", "mid", "large", "enterprise"] as const)[Math.max(0, Math.min(4, ["startup", "small", "mid", "large", "enterprise"].indexOf(SIZES_BY_LEVEL[level][n]!) + shift))];
    const screened = level > 0, applied = level === 1;
    const skillSource: Source = screened ? "screen_call" : "linkedin";
    const yearsNow = Math.max(1, Math.round(total * 0.45)), startNow = year - yearsNow, startBefore = startNow - Math.max(1, Math.round(total * 0.4));
    const skills = k.skills.map(([sname, category, share], si) => ({
      name: sname, category, years: Math.max(1, Math.round(total * share * (si > 4 ? 0.6 : 1))), lastUsedYear: si < 5 ? year : year - 2,
      level: (share >= 0.8 ? "expert" : share >= 0.5 ? "strong" : "working") as "expert" | "strong" | "working", source: skillSource, confidence: (screened ? "stated" : "inferred") as "stated" | "inferred",
    }));
    const base = [95, 135, 175][level] * 1000 + ki * 4000 + (ki === 4 || ki === 7 ? 15000 : 0);
    const workplace = (["hybrid", "remote", "any"] as const)[(i + ki) % 3];
    const profile: Profile = {
      headline: `${k.titles[level]} · ${k.skills.slice(0, 3).map((x) => x[0]).join(", ")}`,
      summary: `${total} years in data, most recently as ${k.titles[level].toLowerCase()} at a ${sizeAt(1)} ${k.industries[level % 2]} company. ${k.now[0]}`,
      totalYears: total, targetRoles: k.targetRoles,
      location: { city, state, workplace: screened ? workplace : undefined, willRelocate: screened ? i % 4 === 0 : undefined },
      workAuthorization: applied || level === 2 ? "US citizen" : undefined,
      compensation: screened ? { currentBase: base, targetBase: Math.round(base * 1.12 / 5000) * 5000, minimumBase: Math.round(base * 1.04 / 5000) * 5000 } : {},
      availability: screened ? { status: (["active", "passive"] as const)[i % 2], noticeWeeks: i % 2 ? 4 : 2 } : {},
      skills,
      experience: [
        { company: EMPLOYERS[(i * 5 + 1) % EMPLOYERS.length], companySize: sizeAt(1), industry: k.industries[level % 2], title: k.titles[level], start: `${startNow}-0${(i % 9) + 1}`, end: null, teamSize: [4, 7, 12][level],
          responsibilities: k.now.slice(0, level === 0 ? 2 : 4), achievements: level === 0 ? [] : k.wins.slice(0, level), tools: k.skills.slice(0, 5).map((x) => x[0]) },
        { company: EMPLOYERS[(i * 5 + 4) % EMPLOYERS.length], companySize: sizeAt(0), industry: k.industries[(level + 1) % 2], title: level === 0 ? "Data Analyst" : k.titles[level - 1], start: `${startBefore}-06`, end: `${startNow}-0${(i % 9) + 1}`,
          responsibilities: k.before, achievements: [], tools: k.skills.slice(2, 6).map((x) => x[0]) },
      ],
      education: [{ school: ["Ohio State University", "University of Texas at Austin", "Georgia Tech", "University of Minnesota"][i % 4], degree: level === 2 && ki % 2 ? "MS" : "BS", field: ["Information Systems", "Computer Science", "Statistics", "Economics"][(i + ki) % 4], year: year - total - 1 }],
      certifications: level === 0 ? [] : k.certs.slice(0, level),
      workStyle: screened
        ? { traits: [{ trait: style[0], evidence: style[1], source: "screen_call" }], prefersCompanySize: style[4], motivators: [style[2]], concerns: [style[3]], communication: level === 2 ? "Comfortable presenting to executives" : "Clear in writing; quieter in large meetings" }
        : { traits: [], prefersCompanySize: [], motivators: [], concerns: [] },
      // Sparse on purpose: the AI screen fills three scales, a call with Adrian fills all, LinkedIn alone fills none.
      personality: screened ? {
        dimensions: Object.fromEntries(STYLE_SCALES[(ki + level * 2) % STYLES.length].slice(0, level === 1 ? 3 : 9).map(([key, value, evidence]) => [key, { value, evidence, source: "screen_call" as const, confidence: (level === 1 ? "inferred" : "stated") as "inferred" | "stated" }])),
        interests: level === 2 ? INTERESTS[(i + ki) % INTERESTS.length] : [],
      } : { dimensions: {}, interests: [] },
      screening: screened ? { date: `${year}-1${level}-0${(i % 8) + 1}`, by: level === 1 ? "retell_ai" : "recruiter", summary: `${first} is a credible ${k.titles[level].toLowerCase()} with real depth in ${k.skills[0][0]} and ${k.skills[1][0]}. ${style[0]}. Wants: ${style[2].toLowerCase()}.`,
        strengths: [`Hands-on with ${k.skills[0][0]} (${skills[0].years} years) and ${k.skills[1][0]} (${skills[1].years} years)`, k.wins[0]], risks: [style[3], ...(workplace === "remote" ? ["Wants fully remote"] : [])] } : undefined,
    };
    const sources: SampleCandidate["sources"] = [{ kind: "linkedin", title: "LinkedIn profile (pasted)", content: `${name}\n${profile.headline}\n${city}, ${state}\n\nExperience\n${profile.experience.map((e) => `${e.title}, ${e.company} (${e.start} to ${e.end ?? "present"})\n- ${e.responsibilities.join("\n- ")}`).join("\n\n")}\n\nSkills: ${k.skills.map((x) => x[0]).join(", ")}` }];
    if (applied) sources.push({ kind: "application", title: "Application form", content: `Work authorization: US citizen\nDesired base pay: $${profile.compensation.targetBase}\nNotice period: ${profile.availability.noticeWeeks} weeks\nOpen to: ${workplace}\nYears with ${k.skills[0][0]}: ${skills[0].years}\nYears with ${k.skills[1][0]}: ${skills[1].years}` });
    if (screened) sources.push({ kind: "screen_call", title: level === 1 ? "Retell AI screen call (summary and transcript excerpt)" : "Screen call with Adrian (notes)", content: `Summary: ${profile.screening!.summary}\n\nQ: How long have you worked with ${k.skills[0][0]}, and when did you last use it?\nA: About ${skills[0].years} years. I use it every day in my current role.\n\nQ: What kind of company do you do your best work in?\nA: ${style[2]}. What I want to avoid is ${style[3].toLowerCase()}.\n\nQ: What base pay would make you move?\nA: I'm at ${Math.round(base / 1000)}k now. I'd want around ${Math.round(profile.compensation.targetBase! / 1000)}k, and I would not move for less than ${Math.round(profile.compensation.minimumBase! / 1000)}k.` });
    return { name, linkedinUrl: `https://www.linkedin.com/in/sample-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`, email: screened ? `${first.toLowerCase()}@mail.example` : undefined, phone: screened ? `(555) 555-01${String(i).padStart(2, "0")}` : undefined,
      consentNote: applied ? "Ticked 'OK to call or text me about this role' on the application form" : undefined, profile, sources };
  }));
}

export type SampleRole = { title: string; clientName: string; description: string; requirements: Requirements; compRange: string };
export const SAMPLE_ROLES: SampleRole[] = [
  { title: "Analytics Engineer (Azure, Snowflake)", clientName: "Mid-size insurer (sample)", compRange: "$125k to $150k",
    description: "We are a mid-size insurance company of about 800 people in Hartford, CT, hiring an analytics engineer for our finance and actuarial data team. You will own dbt models in Snowflake, build Azure Data Factory pipelines that land policy and claims data, and agree metric definitions with finance. We need 4+ years of experience, 3+ years of Snowflake, 2+ years of dbt and 2+ years on Azure. Strong SQL is a must. Nice to have: Power BI and Python. Hybrid, three days a week in the Hartford office. Base pay up to $150,000.",
    requirements: { tools: [{ name: "Snowflake", minYears: 3, must: true }, { name: "dbt", minYears: 2, must: true }, { name: "Azure", minYears: 2, must: true }, { name: "SQL", minYears: 4, must: true }, { name: "Azure Data Factory", minYears: 1, must: false }, { name: "Power BI", minYears: 1, must: false }, { name: "Python", minYears: 1, must: false }], minTotalYears: 4, companySize: "mid", workplace: "hybrid", city: "Hartford", state: "CT", maxBase: 150000, style: { structure: 4, audience: 4 } } },
  { title: "Senior Data Engineer (AWS, Databricks)", clientName: "Enterprise retailer (sample)", compRange: "$150k to $175k",
    description: "A Fortune 500 retailer with 40,000 employees is hiring a senior data engineer for its supply chain data platform. You will build PySpark pipelines on Databricks over Delta Lake, design the layers between raw and business-ready data, and run jobs in Airflow on AWS. The team is 14 engineers with mature review, testing and on-call practices. We need 6+ years of data engineering, 3+ years of Databricks, 4+ years of Spark, 4+ years on AWS and strong Python. Nice to have: Terraform and Kafka. Fully remote within the US. Base pay up to $175,000.",
    requirements: { tools: [{ name: "Databricks", minYears: 3, must: true }, { name: "Spark", minYears: 4, must: true }, { name: "AWS", minYears: 4, must: true }, { name: "Python", minYears: 5, must: true }, { name: "Airflow", minYears: 2, must: false }, { name: "Terraform", minYears: 1, must: false }, { name: "Kafka", minYears: 1, must: false }], minTotalYears: 6, companySize: "enterprise", workplace: "remote", maxBase: 175000, style: { scope: 4, structure: 5 } } },
  { title: "Founding Data Engineer (GCP, BigQuery)", clientName: "Series A startup (sample)", compRange: "$150k to $180k plus equity",
    description: "We are a 35-person Series A fintech startup and you would be our first data hire. You will build the stack from nothing: loaders into BigQuery, dbt models, Airflow, and the first dashboards in Looker. Nobody will hand you tickets; you will talk to every team, decide what matters and ship it. We need 5+ years of experience, 3+ years of BigQuery, 2+ years of dbt, 2+ years of Airflow and strong Python and SQL. Fully remote. Base pay up to $180,000 plus equity.",
    requirements: { tools: [{ name: "BigQuery", minYears: 3, must: true }, { name: "dbt", minYears: 2, must: true }, { name: "Airflow", minYears: 2, must: true }, { name: "Python", minYears: 4, must: true }, { name: "SQL", minYears: 4, must: true }, { name: "GCP", minYears: 3, must: false }, { name: "Looker", minYears: 1, must: false }], minTotalYears: 5, companySize: "startup", workplace: "remote", maxBase: 180000, style: { scope: 1, structure: 1, pace: 5, teamwork: 2 } } },
  { title: "BI Developer (Power BI)", clientName: "Small credit union (sample)", compRange: "$95k to $115k",
    description: "A credit union with 180 employees in Norfolk, VA is hiring a BI developer. You will build Power BI datasets and reports for branch managers and executives, write DAX, maintain SQL Server views and SSIS packages, and gather requirements directly from business users. We need 3+ years of Power BI and 3+ years of SQL Server. This is an on-site role in Norfolk, four days a week. Base pay up to $115,000.",
    requirements: { tools: [{ name: "Power BI", minYears: 3, must: true }, { name: "SQL Server", minYears: 3, must: true }, { name: "SQL", minYears: 3, must: true }], minTotalYears: 3, companySize: "small", workplace: "onsite", city: "Norfolk", state: "VA", maxBase: 115000, style: { audience: 5, demeanor: 2 } } },
  { title: "Data Platform Lead (Kafka, Spark)", clientName: "Large logistics company (sample)", compRange: "$185k to $210k",
    description: "A logistics company with 6,000 employees is hiring a lead for its data platform team in Columbus, OH. You will lead five engineers running Kafka and Spark Structured Streaming on AWS, own the Terraform and Kubernetes setup, and set technical direction with the director of engineering. We need 9+ years of experience, 4+ years of Kafka, 4+ years of Spark, 5+ years on AWS, and experience leading engineers. Hybrid in Columbus. Base pay up to $210,000.",
    requirements: { tools: [{ name: "Kafka", minYears: 4, must: true }, { name: "Spark", minYears: 4, must: true }, { name: "AWS", minYears: 5, must: true }, { name: "Kubernetes", minYears: 2, must: false }, { name: "Terraform", minYears: 2, must: false }, { name: "Scala", minYears: 2, must: false }], minTotalYears: 9, companySize: "large", workplace: "hybrid", city: "Columbus", state: "OH", maxBase: 210000, style: { leadership: 5, confidence: 4 } } },
  { title: "Senior Data Scientist", clientName: "Mid-size health technology company (sample)", compRange: "$140k to $165k",
    description: "A health technology company of 600 people is hiring a senior data scientist. You will build forecasting and risk models in Python, design experiments and causal analyses, and explain results to clinical leaders who are not statisticians. We need 5+ years of experience, strong Python and SQL, and 3+ years building models with scikit-learn or similar. Nice to have: Databricks and MLflow. Fully remote. Base pay up to $165,000.",
    requirements: { tools: [{ name: "Python", minYears: 4, must: true }, { name: "SQL", minYears: 3, must: true }, { name: "scikit-learn", minYears: 3, must: true }, { name: "Databricks", minYears: 1, must: false }, { name: "MLflow", minYears: 1, must: false }], minTotalYears: 5, companySize: "mid", workplace: "remote", maxBase: 165000, style: { audience: 4 } } },
  { title: "Analytics Engineer (dbt, BigQuery)", clientName: "Small consumer app company (sample)", compRange: "$115k to $140k",
    description: "A 120-person consumer app company is hiring its second analytics hire. You will take over a young dbt project on BigQuery, build Looker explores, and be the person marketing and product come to with questions. This suits a strong analyst who has started modeling data and wants to do more of it. We need 3+ years of experience, strong SQL, 1+ years of dbt and 1+ years of Looker or Tableau. Fully remote. Base pay up to $140,000.",
    requirements: { tools: [{ name: "SQL", minYears: 3, must: true }, { name: "dbt", minYears: 1, must: true }, { name: "BigQuery", minYears: 1, must: false }, { name: "Looker", minYears: 1, must: false }, { name: "Tableau", minYears: 1, must: false }], minTotalYears: 3, companySize: "small", workplace: "remote", maxBase: 140000, style: { scope: 2, audience: 4 } } },
];
