import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Trash2,
  Check,
  SlidersHorizontal,
  Copy,
} from 'lucide-react';
import {
  BUILT_IN_GRADING_PROFILES,
  DEFAULT_POM_NAMES,
  GradingProfile,
  STANDARD_GRADING_PROFILE,
  STREET_GRADING_PROFILE,
  inferGradingStep,
} from '../../utils/csvExporter';
import { Button } from '../ui/Button';

const ORDERED_POM_IDS = [
  'FL001',
  'BL001',
  'CW001',
  'WS001',
  'HM001',
  'HH001',
  'SS001',
  'SW001',
  'AH001',
  'SL001',
  'BW001',
  'CO001',
  'CH001',
  'NW001',
  'CW002',
  'FD001',
  'BD001',
  'M17',
  'M18',
  'M19',
  'M20',
  'M21',
  'HD001',
  'HD002',
  'PK001',
  'PK002',
  'PK003',
];

interface EditableRuleRow {
  id: string;
  point: string;
  stepCm: string;
  isStandardPom?: boolean;
}

function buildRowsFromProfile(profile: GradingProfile): EditableRuleRow[] {
  const rows: EditableRuleRow[] = [];
  const seenIds = new Set<string>();

  for (const pomId of ORDERED_POM_IDS) {
    const customMatch = profile.customRows?.find(
      (r) => r.id.trim().toUpperCase() === pomId
    );
    const step =
      customMatch !== undefined
        ? customMatch.stepCm
        : profile.rulesCm[pomId];

    if (step !== undefined) {
      rows.push({
        id: pomId,
        point: customMatch?.point || DEFAULT_POM_NAMES[pomId] || pomId,
        stepCm: String(step),
        isStandardPom: Boolean(STANDARD_GRADING_PROFILE.rulesCm[pomId] !== undefined),
      });
      seenIds.add(pomId);
    }
  }

  for (const cr of profile.customRows || []) {
    const cleanId = cr.id.trim().toUpperCase();
    if (cleanId && seenIds.has(cleanId)) continue;
    rows.push({
      id: cr.id,
      point: cr.point,
      stepCm: String(cr.stepCm),
      isStandardPom: false,
    });
  }

  return rows;
}

export interface GradingProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfileId: string;
  customProfiles: GradingProfile[];
  currentMeasurements?: any[];
  currentUnit?: 'in' | 'cm';
  startInCreateMode?: boolean;
  onSelectProfile: (profile: GradingProfile) => void;
  onSaveCustomProfiles: (
    nextCustomProfiles: GradingProfile[],
    newlySavedProfile?: GradingProfile
  ) => Promise<void>;
}

export function GradingProfileModal({
  isOpen,
  onClose,
  activeProfileId,
  customProfiles,
  currentMeasurements = [],
  currentUnit = 'cm',
  startInCreateMode = false,
  onSelectProfile,
  onSaveCustomProfiles,
}: GradingProfileModalProps) {
  const allProfiles = [...BUILT_IN_GRADING_PROFILES, ...customProfiles];

  const [selectedId, setSelectedId] = useState<string>(activeProfileId || 'standard');
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(startInCreateMode);
  const [draftName, setDraftName] = useState<string>('');
  const [draftBaseType, setDraftBaseType] = useState<'standard' | 'street'>('street');
  const [draftRows, setDraftRows] = useState<EditableRuleRow[]>(() =>
    buildRowsFromProfile(STREET_GRADING_PROFILE)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const initNewDraft = (template: 'standard' | 'street' | 'current') => {
    setErrorMsg('');
    setIsCreatingNew(true);
    setDraftName('');

    if (template === 'current' && currentMeasurements.length > 0) {
      setDraftBaseType('street');
      const rows: EditableRuleRow[] = currentMeasurements.map((m: any, idx: number) => {
        const id = String(m.id || `M${String(idx + 1).padStart(2, '0')}`).trim();
        const stepInUnit = inferGradingStep(m, currentUnit, activeProfileId);
        const stepCm =
          currentUnit === 'in'
            ? Number((stepInUnit * 2.54).toFixed(2))
            : stepInUnit;
        return {
          id,
          point: m.point || DEFAULT_POM_NAMES[id.toUpperCase()] || '',
          stepCm: String(stepCm),
          isStandardPom: STANDARD_GRADING_PROFILE.rulesCm[id.toUpperCase()] !== undefined,
        };
      });
      setDraftRows(rows);
    } else if (template === 'standard') {
      setDraftBaseType('standard');
      setDraftRows(buildRowsFromProfile(STANDARD_GRADING_PROFILE));
    } else {
      setDraftBaseType('street');
      setDraftRows(buildRowsFromProfile(STREET_GRADING_PROFILE));
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    if (startInCreateMode) {
      initNewDraft('street');
    } else {
      setIsCreatingNew(false);
      const target =
        allProfiles.find((p) => p.id === activeProfileId) || STANDARD_GRADING_PROFILE;
      setSelectedId(target.id);
      setDraftName(target.name);
      setDraftBaseType(target.baseType || 'standard');
      setDraftRows(buildRowsFromProfile(target));
    }
  }, [isOpen, startInCreateMode, activeProfileId]);

  if (!isOpen) return null;

  const activeViewingProfile = isCreatingNew
    ? null
    : allProfiles.find((p) => p.id === selectedId) || STANDARD_GRADING_PROFILE;

  const isReadOnlyBuiltIn = Boolean(activeViewingProfile?.isBuiltIn) && !isCreatingNew;

  const handleSelectExistingTab = (prof: GradingProfile) => {
    setIsCreatingNew(false);
    setErrorMsg('');
    setSelectedId(prof.id);
    setDraftName(prof.name);
    setDraftBaseType(prof.baseType || 'standard');
    setDraftRows(buildRowsFromProfile(prof));
  };

  const handleDuplicateToNew = (prof: GradingProfile) => {
    setIsCreatingNew(true);
    setErrorMsg('');
    setDraftName(`${prof.name} Copy`);
    setDraftBaseType(prof.baseType || (prof.id === 'street' ? 'street' : 'standard'));
    setDraftRows(buildRowsFromProfile(prof));
  };

  const handleAddRuleRow = () => {
    const nextIdx = draftRows.length + 1;
    setDraftRows((prev) => [
      ...prev,
      {
        id: `M${String(nextIdx).padStart(2, '0')}`,
        point: '',
        stepCm: '1',
        isStandardPom: false,
      },
    ]);
  };

  const handleUpdateDraftRow = (
    idx: number,
    field: 'id' | 'point' | 'stepCm',
    val: string
  ) => {
    setDraftRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleRemoveDraftRow = (idx: number) => {
    setDraftRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveProfile = async () => {
    const cleanName = draftName.trim();
    if (!cleanName) {
      setErrorMsg('Please enter a name for this grading type (e.g. "Oversized Hoodie").');
      return;
    }

    const rulesCm: Record<string, number> = {};
    const customRows: Array<{ id: string; point: string; stepCm: number }> = [];

    for (const r of draftRows) {
      const parsed = parseFloat(String(r.stepCm).trim().replace(/,/g, '.'));
      const numStep = isNaN(parsed) ? 0 : parsed;
      const cleanId = r.id.trim().toUpperCase();
      const cleanPoint = r.point.trim();

      if (cleanId && STANDARD_GRADING_PROFILE.rulesCm[cleanId] !== undefined) {
        rulesCm[cleanId] = numStep;
      }
      if (cleanId || cleanPoint) {
        customRows.push({
          id: cleanId,
          point: cleanPoint,
          stepCm: numStep,
        });
      }
    }

    const profileObj: GradingProfile = {
      id: isCreatingNew ? `custom_${Date.now()}` : selectedId,
      name: cleanName,
      isBuiltIn: false,
      baseType: draftBaseType,
      rulesCm: {
        ...(draftBaseType === 'street'
          ? STREET_GRADING_PROFILE.rulesCm
          : STANDARD_GRADING_PROFILE.rulesCm),
        ...rulesCm,
      },
      customRows,
    };

    const nextCustomList = isCreatingNew
      ? [...customProfiles, profileObj]
      : customProfiles.map((p) => (p.id === profileObj.id ? profileObj : p));

    setIsSaving(true);
    setErrorMsg('');
    try {
      await onSaveCustomProfiles(nextCustomList, profileObj);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save custom grading profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustom = async (targetProf: GradingProfile) => {
    if (targetProf.isBuiltIn) return;
    if (!confirm(`Delete custom grading profile "${targetProf.name}"?`)) return;

    const nextCustomList = customProfiles.filter((p) => p.id !== targetProf.id);
    setIsSaving(true);
    try {
      await onSaveCustomProfiles(nextCustomList, undefined);
      handleSelectExistingTab(STANDARD_GRADING_PROFILE);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete grading profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
              <SlidersHorizontal size={17} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                Grading Profiles & Custom Rules
              </h2>
              <p className="text-xs text-gray-500">
                Switch between <strong>Standard</strong> and <strong>Street</strong> grading, or create your own custom grading profile (in cm per size step).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-900 rounded-xl hover:bg-gray-200/70 transition-colors"
          >
            <X size={20} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Left Rail: Profile List + Add New */}
          <aside className="w-full md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50/70 p-3.5 flex flex-col gap-2 overflow-y-auto">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">
              Built-In Types
            </div>
            {BUILT_IN_GRADING_PROFILES.map((prof) => {
              const active = !isCreatingNew && selectedId === prof.id;
              return (
                <button
                  key={prof.id}
                  type="button"
                  onClick={() => handleSelectExistingTab(prof)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left border ${
                    active
                      ? 'bg-black text-white border-black shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span>{prof.name}</span>
                  {activeProfileId === prof.id && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        active ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      Active
                    </span>
                  )}
                </button>
              );
            })}

            {customProfiles.length > 0 && (
              <>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1 pt-2">
                  Custom Workspace Types
                </div>
                {customProfiles.map((prof) => {
                  const active = !isCreatingNew && selectedId === prof.id;
                  return (
                    <button
                      key={prof.id}
                      type="button"
                      onClick={() => handleSelectExistingTab(prof)}
                      className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left border ${
                        active
                          ? 'bg-black text-white border-black shadow-sm'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <span className="truncate">{prof.name}</span>
                      {activeProfileId === prof.id && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                            active ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          Active
                        </span>
                      )}
                    </button>
                  );
                })}
              </>
            )}

            <div className="pt-2 mt-auto">
              <button
                type="button"
                onClick={() => initNewDraft('street')}
                className={`w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                  isCreatingNew
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                }`}
              >
                <Plus size={14} />
                <span>Add New Grading</span>
              </button>
            </div>
          </aside>

          {/* Right Editor / Inspector */}
          <div className="flex-1 min-w-0 p-4 sm:p-5 overflow-y-auto space-y-4">
            {isCreatingNew || !isReadOnlyBuiltIn ? (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                      {isCreatingNew ? 'New Grading Profile Name' : 'Grading Profile Name'}
                    </label>
                    <input
                      type="text"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder="e.g. Oversized Street, Women's Fitted, Heavy Fleece..."
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-900 focus:outline-none focus:border-black"
                    />
                  </div>

                  {isCreatingNew && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-gray-500 mr-1">
                        Pre-fill from:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftBaseType('standard');
                          setDraftRows(buildRowsFromProfile(STANDARD_GRADING_PROFILE));
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-xs font-bold text-gray-700"
                      >
                        Standard
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftBaseType('street');
                          setDraftRows(buildRowsFromProfile(STREET_GRADING_PROFILE));
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-xs font-bold text-gray-700"
                      >
                        Street
                      </button>
                      {currentMeasurements.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const curName = draftName;
                            initNewDraft('current');
                            setDraftName(curName);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-bold text-blue-700"
                        >
                          Current Tech Pack
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                <div>
                  <div className="text-sm font-bold text-gray-900">
                    {activeViewingProfile?.name} Grading (Built-In Preset)
                  </div>
                  <div className="text-xs text-gray-500">
                    Increments shown in <strong>cm</strong> per size step (automatically converted when viewing in inches).
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => activeViewingProfile && handleDuplicateToNew(activeViewingProfile)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-xs font-bold text-gray-700 shrink-0"
                >
                  <Copy size={13} />
                  Duplicate & Customize
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600">
                {errorMsg}
              </div>
            )}

            {/* Rules Table */}
            <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="py-2.5 px-3 w-24 font-bold">DIM ID</th>
                    <th className="py-2.5 px-3 font-bold">Point of Measure</th>
                    <th className="py-2.5 px-3 w-32 text-center font-bold">Grade Step (cm)</th>
                    {!isReadOnlyBuiltIn && <th className="py-2.5 px-2 w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {draftRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/70">
                      <td className="py-2 px-3 font-mono font-bold text-gray-600">
                        {isReadOnlyBuiltIn ? (
                          row.id
                        ) : (
                          <input
                            type="text"
                            value={row.id}
                            onChange={(e) => handleUpdateDraftRow(idx, 'id', e.target.value)}
                            placeholder="e.g. M22"
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 font-mono text-xs uppercase focus:bg-white focus:border-black outline-none"
                          />
                        )}
                      </td>
                      <td className="py-2 px-3 font-medium text-gray-800">
                        {isReadOnlyBuiltIn ? (
                          row.point
                        ) : (
                          <input
                            type="text"
                            value={row.point}
                            onChange={(e) => handleUpdateDraftRow(idx, 'point', e.target.value)}
                            placeholder="Point of measure name..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs focus:bg-white focus:border-black outline-none"
                          />
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-blue-600">
                        {isReadOnlyBuiltIn ? (
                          row.stepCm
                        ) : (
                          <input
                            type="number"
                            step="0.05"
                            value={row.stepCm}
                            onChange={(e) => handleUpdateDraftRow(idx, 'stepCm', e.target.value)}
                            className="w-24 mx-auto block text-center bg-blue-50/50 border border-blue-200 rounded-lg px-2 py-1 font-mono text-xs font-bold text-blue-700 focus:bg-white focus:border-blue-600 outline-none"
                          />
                        )}
                      </td>
                      {!isReadOnlyBuiltIn && (
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveDraftRow(idx)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                            title="Remove row"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {!isReadOnlyBuiltIn && (
                <div className="p-2.5 border-t border-gray-100 bg-gray-50/60">
                  <button
                    type="button"
                    onClick={handleAddRuleRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-xs font-bold text-gray-700"
                  >
                    <Plus size={13} />
                    Add Custom POM Rule
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
          <div>
            {!isCreatingNew && activeViewingProfile && !activeViewingProfile.isBuiltIn && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleDeleteCustom(activeViewingProfile)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
                Delete Profile
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 transition-colors"
            >
              Cancel
            </button>

            {isReadOnlyBuiltIn && activeViewingProfile ? (
              <Button
                type="button"
                onClick={() => {
                  onSelectProfile(activeViewingProfile);
                  onClose();
                }}
                className="bg-black hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap"
              >
                <Check size={15} className="mr-1.5 shrink-0" />
                <span>Use {activeViewingProfile.name} Grading</span>
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSaveProfile}
                isLoading={isSaving}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap"
              >
                {!isSaving && <Check size={15} className="mr-1.5 shrink-0" />}
                <span>
                  {isSaving
                    ? 'Saving...'
                    : isCreatingNew
                    ? 'Save & Apply New Grading'
                    : 'Save Changes & Apply'}
                </span>
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}
