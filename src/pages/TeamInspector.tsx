import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, 
  Users, 
  Layers, 
  Search, 
  ExternalLink, 
  CheckCircle, 
  AlertTriangle, 
  Copy, 
  Folder, 
  RefreshCw, 
  Eye, 
  FileText, 
  Code, 
  ArrowRight,
  Shield,
  Activity,
  UserCheck,
  Building,
  Lock,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  getAllCompanies, 
  CompanyData, 
  getCompanyTechPacks, 
  TechPackData, 
  getAllUsers, 
  getCompanyFolders,
  FolderData
} from '../services/dbService';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

interface TeamStats {
  company: CompanyData;
  members: any[];
  packCount: number;
  folderCount: number;
}

export function TeamInspector() {
  const navigate = useNavigate();
  const { isCoreAdmin, inspectedCompany, setInspectedCompany, exitInspection } = useAuth();

  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<TeamStats[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [teamPacksLoading, setTeamPacksLoading] = useState<Record<string, boolean>>({});
  const [teamPacks, setTeamPacks] = useState<Record<string, TechPackData[]>>({});
  const [activeTab, setActiveTab] = useState<'directory' | 'health'>('directory');

  // Diagnostics Modal State
  const [diagnosticPack, setDiagnosticPack] = useState<TechPackData | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [companies, allUsers] = await Promise.all([
        getAllCompanies(),
        getAllUsers()
      ]);

      // Group users by companyId
      const usersByCompany: Record<string, any[]> = {};
      allUsers.forEach((u: any) => {
        const cId = u.companyId || 'default_company';
        if (!usersByCompany[cId]) usersByCompany[cId] = [];
        usersByCompany[cId].push(u);
      });

      // Create team stat cards
      const statsPromises = companies.map(async (company) => {
        try {
          const packs = await getCompanyTechPacks(company.id);
          const folders = await getCompanyFolders(company.id);
          return {
            company,
            members: usersByCompany[company.id] || [],
            packCount: packs.length,
            folderCount: folders.length
          };
        } catch {
          return {
            company,
            members: usersByCompany[company.id] || [],
            packCount: 0,
            folderCount: 0
          };
        }
      });

      const stats = await Promise.all(statsPromises);
      // Sort by pack count (most active first), then company name
      stats.sort((a, b) => b.packCount - a.packCount || (a.company.name || '').localeCompare(b.company.name || ''));
      setTeams(stats);
    } catch (err) {
      console.error("Failed loading team inspector data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isCoreAdmin) {
      loadData();
    }
  }, [isCoreAdmin]);

  // Access control guard
  if (!isCoreAdmin) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center px-4">
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4 border border-red-200">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Restricted Access</h2>
        <p className="text-gray-500 max-w-md mb-6 text-sm">
          This portal is strictly reserved for Catalyst core administrators and diagnostics.
        </p>
        <Button onClick={() => navigate('/')} variant="primary" className="rounded-full px-6">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const handleToggleExpandTeam = async (companyId: string) => {
    if (expandedTeamId === companyId) {
      setExpandedTeamId(null);
      return;
    }

    setExpandedTeamId(companyId);
    if (!teamPacks[companyId]) {
      setTeamPacksLoading(prev => ({ ...prev, [companyId]: true }));
      try {
        const packs = await getCompanyTechPacks(companyId);
        setTeamPacks(prev => ({ ...prev, [companyId]: packs }));
      } catch (e) {
        console.error("Failed loading team tech packs:", e);
      } finally {
        setTeamPacksLoading(prev => ({ ...prev, [companyId]: false }));
      }
    }
  };

  const handleInspectTeamDashboard = (company: CompanyData) => {
    setInspectedCompany({
      id: company.id,
      name: company.name || 'Team Workspace'
    });
    sessionStorage.removeItem('activeFolderId');
    navigate('/');
  };

  const handleOpenPackInEditor = (pack: TechPackData, company: CompanyData) => {
    setInspectedCompany({
      id: company.id,
      name: company.name || 'Team Workspace'
    });
    navigate(`/pack/${pack.id}`, { state: { ...pack } });
  };

  const handleCopyJson = (obj: any) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Filtered teams list
  const filteredTeams = teams.filter(({ company, members }) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = (company.name || '').toLowerCase().includes(q);
    const idMatch = company.id.toLowerCase().includes(q);
    const codeMatch = (company.joinCode || '').toLowerCase().includes(q);
    const memberMatch = members.some((m: any) => 
      (m.email || '').toLowerCase().includes(q) || 
      (m.name || '').toLowerCase().includes(q)
    );
    return nameMatch || idMatch || codeMatch || memberMatch;
  });

  const totalTeams = teams.length;
  const totalPacks = teams.reduce((acc, t) => acc + t.packCount, 0);
  const totalMembers = teams.reduce((acc, t) => acc + t.members.length, 0);

  // Health check helpers for single pack
  const getPackHealthStatus = (pack: TechPackData) => {
    const issues: string[] = [];
    if (!pack.imageUrl) {
      issues.push("Missing primary garment image");
    } else if (pack.imageUrl.startsWith('data:')) {
      issues.push("Uncompressed base64 main image (may cause slow loads)");
    }

    const techPack = pack.techPack || {};
    const measurements = techPack.measurements || [];
    if (!measurements.length) {
      issues.push("No measurements or POMs defined");
    }

    // Check for heavy base64 strings in gallery
    const gallery = techPack.gallery || [];
    const base64GalleryCount = gallery.filter((img: string) => typeof img === 'string' && img.startsWith('data:')).length;
    if (base64GalleryCount > 0) {
      issues.push(`${base64GalleryCount} raw base64 images in gallery`);
    }

    return issues;
  };

  return (
    <div className="max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <Activity size={22} />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-gray-900">
              Team Diagnostics Portal
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              Core Admin
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Inspect workspaces across all teams, audit tech pack configurations, and diagnose client issues in real time.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={loadData}
            variant="secondary"
            className="flex items-center gap-2 rounded-full text-xs font-semibold px-4"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Data</span>
          </Button>

          {inspectedCompany && (
            <Button
              onClick={exitInspection}
              variant="secondary"
              className="flex items-center gap-1.5 rounded-full text-xs font-semibold px-4 text-red-600 hover:bg-red-50 border-red-200"
            >
              <span>Exit Active Inspection</span>
            </Button>
          )}
        </div>
      </div>

      {/* Global Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <GlassCard className="p-5 flex items-center gap-4 border-gray-200">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Building size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalTeams}</div>
            <div className="text-xs font-medium text-gray-500">Registered Teams</div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 flex items-center gap-4 border-gray-200">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
            <Layers size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalPacks}</div>
            <div className="text-xs font-medium text-gray-500">Total Tech Packs</div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 flex items-center gap-4 border-gray-200">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <Users size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalMembers}</div>
            <div className="text-xs font-medium text-gray-500">Total Team Members</div>
          </div>
        </GlassCard>
      </div>

      {/* Navigation Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('directory')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'directory'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Teams Directory ({filteredTeams.length})
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'health'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <ShieldAlert size={14} className="text-amber-500" />
            <span>Health & Diagnostics Scanner</span>
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search teams, emails, codes, IDs..."
            className="w-full bg-white border border-gray-200 rounded-full pl-9 pr-4 py-2 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black transition-all shadow-xs"
          />
        </div>
      </div>

      {/* TAB 1: TEAMS DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-24 text-center text-gray-400 text-sm">
              <RefreshCw size={24} className="animate-spin mx-auto mb-3 text-gray-300" />
              Loading team directory and tech packs...
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-sm bg-white rounded-2xl border border-gray-200 p-8">
              No teams matched your search query.
            </div>
          ) : (
            filteredTeams.map(({ company, members, packCount, folderCount }) => {
              const isInspectingThis = inspectedCompany?.id === company.id;
              const isExpanded = expandedTeamId === company.id;
              const packs = teamPacks[company.id] || [];
              const isLoadingPacks = teamPacksLoading[company.id];

              return (
                <GlassCard
                  key={company.id}
                  className={`p-0 overflow-hidden transition-all border ${
                    isInspectingThis 
                      ? 'border-amber-400 ring-2 ring-amber-400/20' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Card Header Row */}
                  <div className="p-5 sm:p-6 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                        <h2 className="text-lg font-bold text-gray-900 truncate">
                          {company.name || 'Untitled Company'}
                        </h2>
                        {company.joinCode && (
                          <span className="text-[11px] font-mono font-bold bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-md border border-gray-200">
                            CODE: {company.joinCode}
                          </span>
                        )}
                        {isInspectingThis && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                            Currently Inspecting
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="font-mono text-[11px] text-gray-400">
                          ID: {company.id}
                        </span>
                        <span>•</span>
                        <span>
                          <strong>{members.length}</strong> member{members.length !== 1 ? 's' : ''}
                        </span>
                        <span>•</span>
                        <span>
                          <strong>{packCount}</strong> tech pack{packCount !== 1 ? 's' : ''}
                        </span>
                        <span>•</span>
                        <span>
                          <strong>{folderCount}</strong> folder{folderCount !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Member list preview */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        {members.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">No registered users</span>
                        ) : (
                          members.map((m: any) => (
                            <span
                              key={m.uid || m.email}
                              className="inline-flex items-center gap-1 text-xs bg-gray-50 border border-gray-200/80 rounded-full px-2.5 py-0.5 text-gray-700"
                              title={`${m.email || 'No email'} (${m.role || 'staff'})`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                              <span className="font-medium truncate max-w-[140px]">
                                {m.name || m.email?.split('@')[0] || 'Member'}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                [{m.role || 'staff'}]
                              </span>
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Team Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        onClick={() => handleToggleExpandTeam(company.id)}
                        variant="secondary"
                        className="rounded-xl text-xs font-semibold px-3 py-2 flex items-center gap-1.5"
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        <span>{isExpanded ? 'Hide Tech Packs' : `View Tech Packs (${packCount})`}</span>
                      </Button>

                      <Button
                        onClick={() => handleInspectTeamDashboard(company)}
                        variant="primary"
                        className="rounded-xl text-xs font-bold px-4 py-2 flex items-center gap-1.5 bg-black text-white hover:bg-gray-800 shadow-xs cursor-pointer"
                      >
                        <Eye size={15} />
                        <span>Inspect Team Dashboard</span>
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Tech Packs Section */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50 p-5 sm:p-6 animate-in fade-in">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                          Garment Tech Packs for {company.name}
                        </h3>
                        <span className="text-xs text-gray-400 font-medium">
                          {packs.length} item{packs.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {isLoadingPacks ? (
                        <div className="py-10 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Loading tech pack data...</span>
                        </div>
                      ) : packs.length === 0 ? (
                        <div className="py-8 text-center text-xs text-gray-400 bg-white rounded-xl border border-gray-200">
                          This team has not created any tech packs yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {packs.map((pack) => {
                            const issues = getPackHealthStatus(pack);
                            const isLocked = pack.isLocked || pack.techPack?.isLocked;

                            return (
                              <div
                                key={pack.id}
                                className="bg-white rounded-xl border border-gray-200 p-3.5 flex flex-col justify-between hover:shadow-md transition-shadow"
                              >
                                <div className="flex items-start gap-3 mb-3">
                                  <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
                                    {pack.imageUrl ? (
                                      <img
                                        src={pack.imageUrl}
                                        alt={pack.name}
                                        className="w-full h-full object-contain"
                                      />
                                    ) : (
                                      <ImageIcon size={20} className="text-gray-300" />
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <h4 className="text-sm font-bold text-gray-900 truncate">
                                        {pack.name || 'Untitled'}
                                      </h4>
                                      {isLocked && (
                                        <span title="Locked">
                                          <Lock size={12} className="text-gray-400 shrink-0" />
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-gray-400 truncate">
                                      By: {pack.creatorEmail || 'Unknown user'}
                                    </p>
                                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                                      {pack.updatedAt?.toDate ? pack.updatedAt.toDate().toLocaleDateString() : 'Recent'}
                                    </p>
                                  </div>
                                </div>

                                {/* Health warning indicator */}
                                {issues.length > 0 && (
                                  <div className="mb-3 p-2 bg-amber-50 rounded-lg border border-amber-200/60 text-[11px] text-amber-800 flex items-start gap-1.5">
                                    <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                                    <span className="truncate">{issues[0]}</span>
                                  </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                                  <button
                                    onClick={() => setDiagnosticPack(pack)}
                                    className="text-[11px] text-gray-600 hover:text-black font-semibold flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                                    title="View Raw Data & Diagnostics"
                                  >
                                    <Code size={13} className="text-gray-400" />
                                    <span>Inspect Data</span>
                                  </button>

                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => navigate(`/share/${pack.id}`)}
                                      className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-md transition-colors"
                                      title="Open Public Share View"
                                    >
                                      <ExternalLink size={14} />
                                    </button>

                                    <button
                                      onClick={() => handleOpenPackInEditor(pack, company)}
                                      className="text-xs bg-black text-white hover:bg-gray-800 font-bold px-3 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                      title="Open this tech pack in the editor under this team's context"
                                    >
                                      <span>Editor</span>
                                      <ArrowRight size={12} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </GlassCard>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: HEALTH & DIAGNOSTICS SCANNER */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <ShieldAlert size={20} className="text-amber-500" />
              <span>Workspace Audit & Anomaly Detection</span>
            </h2>
            <p className="text-xs text-gray-500 mb-6">
              Automated checks scanning team workspaces for data inconsistencies, uncompressed images, and orphaned projects.
            </p>

            <div className="space-y-4">
              {/* Check 1: Teams with zero members */}
              {teams.filter(t => t.members.length === 0).length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-amber-900">
                      Empty Teams Detected ({teams.filter(t => t.members.length === 0).length})
                    </h3>
                    <p className="text-xs text-amber-800 mt-1">
                      These companies have no assigned registered members:
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {teams.filter(t => t.members.length === 0).map(t => (
                        <span key={t.company.id} className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-amber-200">
                          {t.company.name} ({t.company.id})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Check 2: Active teams summary */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3">
                <CheckCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-900">
                    Active Client Teams ({teams.filter(t => t.packCount > 0).length})
                  </h3>
                  <p className="text-xs text-emerald-800 mt-1">
                    These teams actively have saved Tech Packs in Firestore and can be inspected anytime.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TECH PACK DIAGNOSTIC & RAW JSON MODAL */}
      {diagnosticPack && (
        <Modal
          isOpen={Boolean(diagnosticPack)}
          onClose={() => setDiagnosticPack(null)}
          title={`Diagnostic Inspection: ${diagnosticPack.name}`}
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Quick Health Summary */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-xs space-y-2">
              <div className="font-bold text-gray-800 text-sm mb-1">Configuration Overview</div>
              <div className="grid grid-cols-2 gap-2 text-gray-600">
                <div><strong>Pack ID:</strong> {diagnosticPack.id}</div>
                <div><strong>Company ID:</strong> {diagnosticPack.companyId}</div>
                <div><strong>Creator:</strong> {diagnosticPack.creatorEmail || 'Unknown'}</div>
                <div><strong>Locked:</strong> {diagnosticPack.isLocked ? 'Yes' : 'No'}</div>
                <div><strong>POMs Count:</strong> {diagnosticPack.techPack?.measurements?.length || 0}</div>
                <div><strong>BOM Count:</strong> {diagnosticPack.techPack?.bom?.length || 0}</div>
              </div>

              {/* Health Warnings */}
              {getPackHealthStatus(diagnosticPack).length > 0 && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="font-bold text-amber-800 mb-1">Potential Issues:</div>
                  <ul className="list-disc list-inside text-amber-700 space-y-0.5">
                    {getPackHealthStatus(diagnosticPack).map((issue, idx) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Raw JSON Viewer */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Raw Firestore Document JSON
                </span>
                <Button
                  onClick={() => handleCopyJson(diagnosticPack)}
                  variant="secondary"
                  className="rounded-lg text-xs py-1 px-3 flex items-center gap-1.5"
                >
                  {copySuccess ? <CheckCircle size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  <span>{copySuccess ? 'Copied!' : 'Copy JSON'}</span>
                </Button>
              </div>

              <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
                {JSON.stringify(diagnosticPack, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
