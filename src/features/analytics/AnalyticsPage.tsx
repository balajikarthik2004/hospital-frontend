import { useState } from 'react';
import {
  ArrowPathIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ClockIcon,
  DocumentMagnifyingGlassIcon,
  HandRaisedIcon,
  InboxStackIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingPane,
  PageHeader,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
} from '@/components/common';
import {
  BarCard,
  CHART_COLORS,
  FunnelCard,
  GaugeCard,
  KpiCard,
  SEVERITY_COLORS,
  TrendChart,
} from '@/components/charts';
import { useApi } from '@/hooks/useApi';
import { confidencePct, fmtDuration, fmtShort, pct, titleCase } from '@/lib/utils';

type TabKey = 'operations' | 'quality' | 'ai';

export function AnalyticsPage() {
  const [tab, setTab] = useState<TabKey>('operations');

  const kpis = useApi<any>('/analytics/kpis');
  const volume = useApi<{ series: any[] }>('/analytics/discharge-volume?days=30');
  const funnel = useApi<{ funnel: { stage: string; count: number }[] }>('/analytics/funnel');
  const occupancy = useApi<{ wards: any[] }>('/analytics/bed-occupancy');
  const turnover = useApi<{ turnover: any[] }>('/analytics/bed-turnover');
  const readmission = useApi<any>('/analytics/readmission-rate?months=6');
  const agents = useApi<any>('/analytics/agent-performance');

  const loading = kpis.loading && !kpis.data;
  const error = kpis.error;

  if (loading) return <LoadingPane label="Crunching the numbers" />;
  if (error) return <ErrorState message={error} onRetry={kpis.refetch} />;

  const k = kpis.data ?? {};

  return (
    <>
      <PageHeader
        eyebrow="Oversight"
        title="Analytics"
        story="Three questions: is the service moving patients through, is the discharge quality holding up, and are the agents earning their place in the workflow?"
      />

      <div className="mb-5">
        <Tabs
          tabs={[
            { key: 'operations', label: 'Operations' },
            { key: 'quality', label: 'Quality' },
            { key: 'ai', label: 'AI performance' },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'operations' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Bed occupancy"
              value={pct(k.bedOccupancyPct ?? 0)}
              hint={`${k.bedsOccupied}/${k.bedsTotal} beds`}
              icon={<BuildingOffice2Icon />}
            />
            <KpiCard
              label="Active admissions"
              value={k.activeAdmissions ?? 0}
              hint={`${k.totalPatients} patients on file`}
              tone="info"
              icon={<UserGroupIcon />}
            />
            <KpiCard
              label="Avg preparation time"
              value={(k.avgPrepHours ?? 0).toFixed(1)}
              unit="h"
              hint={`vs ${k.baselinePrepHours} h manual baseline`}
              // Green only when it actually beats the manual baseline.
              tone={(k.avgPrepHours ?? 0) <= (k.baselinePrepHours ?? 0) ? 'success' : 'warning'}
              icon={<ClockIcon />}
              delta={k.timeSavedPct ? { value: k.timeSavedPct, goodWhen: 'up' } : undefined}
            />
            <KpiCard
              label="Awaiting review"
              value={k.packagesPendingReview ?? 0}
              hint={`${k.packagesCompleted} completed to date`}
              tone="warning"
              icon={<InboxStackIcon />}
            />
          </div>

          <TrendChart
            title="Discharge volume"
            subtitle="Admissions, discharges and AI packages started, last 30 days"
            data={(volume.data?.series ?? []).map((d) => ({ ...d, date: fmtShort(d.date) }))}
            xKey="date"
            area
            series={[
              { key: 'admissions', label: 'Admissions', color: '#3C5E93' },
              { key: 'discharges', label: 'Discharges', color: '#1E7B6B' },
              { key: 'aiPackages', label: 'AI packages', color: '#7B4FA8' },
            ]}
          />

          <div className="grid gap-5 xl:grid-cols-3">
            <GaugeCard
              title="Preparation time"
              subtitle="Average, against the 3.2 h manual baseline"
              value={k.avgPrepHours ?? 0}
              max={4}
              unit=" h"
              color="#1E7B6B"
              caption={
                k.timeSavedPct
                  ? `${pct(k.timeSavedPct)} faster than preparing it by hand`
                  : 'No completed packages yet'
              }
            />
            <FunnelCard
              title="Discharge pipeline"
              subtitle="Packages by furthest stage reached"
              stages={funnel.data?.funnel ?? []}
            />
            <GaugeCard
              title="Follow-up compliance"
              subtitle="Appointments confirmed or attended"
              value={k.followUpComplianceRatePct ?? 0}
              color="#3C5E93"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <BarCard
              title="Bed occupancy by ward"
              data={occupancy.data?.wards ?? []}
              xKey="ward"
              horizontal
              stacked
              series={[
                { key: 'occupied', label: 'Occupied', color: '#3C5E93' },
                { key: 'available', label: 'Available', color: '#1E7B6B' },
                { key: 'reserved', label: 'Reserved', color: '#D97706' },
                { key: 'maintenance', label: 'Maintenance', color: '#B0ACA3' },
              ]}
            />
            <Card padded={false}>
              <div className="p-5 pb-0">
                <CardHeader
                  title="Bed turnover"
                  subtitle="Trailing 30 days, per ward"
                />
              </div>
              <Table>
                <thead>
                  <tr>
                    <Th>Ward</Th>
                    <Th>Beds</Th>
                    <Th>Admissions</Th>
                    <Th>Discharges</Th>
                    <Th>Turnover / bed</Th>
                    <Th>Avg stay</Th>
                  </tr>
                </thead>
                <tbody>
                  {(turnover.data?.turnover ?? []).map((row: any) => (
                    <Tr key={row.ward}>
                      <Td className="font-medium">{row.ward}</Td>
                      <Td className="tabular-nums">{row.beds}</Td>
                      <Td className="tabular-nums">{row.admissions}</Td>
                      <Td className="tabular-nums">{row.discharges}</Td>
                      <Td className="tabular-nums">{row.turnoverPerBed}</Td>
                      <Td className="tabular-nums">
                        {row.avgLengthOfStayDays ? `${row.avgLengthOfStayDays} d` : '—'}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>
        </div>
      )}

      {tab === 'quality' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Discrepancy detection rate"
              value={pct(agents.data?.detectionRatePct ?? 0)}
              hint="Packages where at least one flag was raised"
              tone="primary"
              icon={<DocumentMagnifyingGlassIcon />}
            />
            <KpiCard
              label="False positive rate"
              value={pct(agents.data?.falsePositiveRatePct ?? 0)}
              hint="Resolved flags that clinicians dismissed"
              tone={(agents.data?.falsePositiveRatePct ?? 0) > 25 ? 'warning' : 'success'}
              icon={<HandRaisedIcon />}
            />
            <KpiCard
              label="30-day readmission"
              value={pct(readmission.data?.overallPct ?? 0)}
              hint={`${readmission.data?.readmissions ?? 0} of ${readmission.data?.eligibleDischarges ?? 0} discharges`}
              tone={(readmission.data?.overallPct ?? 0) > 15 ? 'danger' : 'success'}
              icon={<ArrowPathIcon />}
            />
            <KpiCard
              label="Follow-up compliance"
              value={pct(k.followUpComplianceRatePct ?? 0)}
              tone="info"
              icon={<CalendarDaysIcon />}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <TrendChart
              title="30-day readmission rate"
              subtitle="Monthly, last six months"
              data={readmission.data?.trend ?? []}
              xKey="month"
              suffix="%"
              series={[{ key: 'ratePct', label: 'Readmission rate', color: '#DC2626' }]}
            />
            <BarCard
              title="Flags by severity and outcome"
              subtitle="What clinicians did with each finding"
              data={agents.data?.severityDistribution ?? []}
              xKey="severity"
              stacked
              series={[
                { key: 'accepted', label: 'Accepted', color: '#1E7B6B' },
                { key: 'modified', label: 'Modified', color: '#3C5E93' },
                { key: 'dismissed', label: 'Dismissed', color: '#B0ACA3' },
                { key: 'pending', label: 'Still open', color: '#D97706' },
              ]}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <BarCard
              title="Findings by type"
              subtitle="What the reconciliation rules caught"
              data={(agents.data?.typeDistribution ?? []).map((t: any) => ({
                ...t,
                type: titleCase(t.type),
              }))}
              xKey="type"
              horizontal
              series={[{ key: 'count', label: 'Findings', color: '#7B4FA8' }]}
            />
            <Card padded={false}>
              <div className="p-5 pb-0">
                <CardHeader
                  title="Flag severity breakdown"
                  subtitle="Resolution status per severity band"
                />
              </div>
              <Table>
                <thead>
                  <tr>
                    <Th>Severity</Th>
                    <Th>Total</Th>
                    <Th>Accepted</Th>
                    <Th>Modified</Th>
                    <Th>Dismissed</Th>
                    <Th>Open</Th>
                  </tr>
                </thead>
                <tbody>
                  {(agents.data?.severityDistribution ?? []).map((row: any) => (
                    <Tr key={row.severity}>
                      <Td>
                        <Badge
                          style={{
                            background: `${SEVERITY_COLORS[row.severity as 'critical']}1a`,
                            color: SEVERITY_COLORS[row.severity as 'critical'],
                          }}
                        >
                          {titleCase(row.severity)}
                        </Badge>
                      </Td>
                      <Td className="font-semibold tabular-nums">{row.total}</Td>
                      <Td className="tabular-nums">{row.accepted}</Td>
                      <Td className="tabular-nums">{row.modified}</Td>
                      <Td className="tabular-nums">{row.dismissed}</Td>
                      <Td className="tabular-nums">{row.pending}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>
        </div>
      )}

      {tab === 'ai' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(agents.data?.perAgent ?? []).map((agent: any) => (
              <Card key={agent.agent} className="relative overflow-hidden">
                <span
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ background: agent.color }}
                />
                <div className="pl-1">
                  <p className="text-xs font-semibold">{agent.agent}</p>
                  <p className="mt-2 text-2xl font-bold" style={{ color: agent.color }}>
                    {confidencePct(agent.avgConfidence)}
                  </p>
                  <p className="text-[11px] uppercase tracking-wide text-faint">
                    average confidence
                  </p>
                  <dl className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-muted">Runs</dt>
                      <dd className="font-medium tabular-nums">{agent.runs}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Accepted</dt>
                      <dd className="font-medium tabular-nums">{pct(agent.acceptedPct)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Overridden</dt>
                      <dd className="font-medium tabular-nums">{pct(agent.overridePct)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Avg runtime</dt>
                      <dd className="font-medium tabular-nums">
                        {fmtDuration(agent.avgDurationMs)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <BarCard
              title="Clinician response per agent"
              subtitle="Approved as drafted, edited, or rejected"
              data={agents.data?.perAgent ?? []}
              xKey="agent"
              horizontal
              stacked
              suffix="%"
              series={[
                { key: 'acceptedPct', label: 'Accepted', color: '#1E7B6B' },
                { key: 'editedPct', label: 'Edited', color: '#D97706' },
                { key: 'rejectedPct', label: 'Rejected', color: '#DC2626' },
              ]}
            />
            <BarCard
              title="Time from initiation to full approval"
              subtitle="Completed packages only"
              data={agents.data?.completionHistogram ?? []}
              xKey="bucket"
              series={[{ key: 'count', label: 'Packages', color: '#7B4FA8' }]}
            />
          </div>

          <Card padded={false}>
            <div className="p-5 pb-0">
              <CardHeader
                title="Agent scorecard"
                subtitle="Confidence is self-reported from data completeness; override rate is the clinician's verdict"
              />
            </div>
            {(agents.data?.perAgent ?? []).length === 0 ? (
              <EmptyState title="No agent runs yet" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Agent</Th>
                    <Th>Runs</Th>
                    <Th>Avg confidence</Th>
                    <Th>Accepted</Th>
                    <Th>Edited</Th>
                    <Th>Rejected</Th>
                    <Th>Override rate</Th>
                    <Th>Avg runtime</Th>
                  </tr>
                </thead>
                <tbody>
                  {(agents.data?.perAgent ?? []).map((agent: any) => (
                    <Tr key={agent.agent}>
                      <Td>
                        <span className="flex items-center gap-2 font-medium">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: agent.color }}
                          />
                          {agent.agent}
                        </span>
                      </Td>
                      <Td className="tabular-nums">{agent.runs}</Td>
                      <Td className="tabular-nums">{confidencePct(agent.avgConfidence)}</Td>
                      <Td className="tabular-nums">{pct(agent.acceptedPct)}</Td>
                      <Td className="tabular-nums">{pct(agent.editedPct)}</Td>
                      <Td className="tabular-nums">{pct(agent.rejectedPct)}</Td>
                      <Td>
                        <Badge tone={agent.overridePct > 30 ? 'warning' : 'success'}>
                          {pct(agent.overridePct)}
                        </Badge>
                      </Td>
                      <Td className="tabular-nums">{fmtDuration(agent.avgDurationMs)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader
              title="How to read these numbers"
              subtitle="So the scorecard is not mistaken for a claim of accuracy"
            />
            <ul className="space-y-2 text-sm text-muted">
              <li>
                <strong>Confidence</strong> is the agent's own estimate of how complete the
                underlying record was. It is not a probability that the output is correct.
              </li>
              <li>
                <strong>Override rate</strong> is the honest quality signal: how often a clinician
                had to change or reject what the agent produced.
              </li>
              <li>
                <strong>False positive rate</strong> counts flags a pharmacist dismissed. A low
                rate matters as much as detection — alert fatigue is a patient safety risk.
              </li>
              <li>
                Medication reconciliation and follow-up planning are deterministic rules engines,
                so their output is reproducible and auditable, not probabilistic.
              </li>
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
