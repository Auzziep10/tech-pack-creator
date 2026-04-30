const fs = require('fs');

const path = 'src/pages/TechPackEditor.tsx';
let content = fs.readFileSync(path, 'utf8');

// Insert language state
const stateInjection = `
  const LANGUAGES = ['English', 'Spanish', 'Mandarin', 'Vietnamese', 'Portuguese', 'Italian', 'French', 'Turkish', 'Bengali'];
  const [activeLanguage, setActiveLanguage] = useState('English');
  const [isTranslating, setIsTranslating] = useState(false);

  const handleLanguageChange = async (newLang) => {
    if (newLang === 'English') {
      setActiveLanguage(newLang);
      return;
    }
    
    if (data.translations?.[newLang]) {
      setActiveLanguage(newLang);
      return;
    }
    
    setIsTranslating(true);
    try {
      const translated = await translateTechPack(data, newLang);
      setData((prev) => ({
        ...prev,
        translations: {
           ...(prev.translations || {}),
           [newLang]: translated
        }
      }));
      setActiveLanguage(newLang);
      pushLog("Translated to " + newLang);
    } catch (err) {
      alert(err.message || "Failed to translate tech pack.");
    } finally {
      setIsTranslating(false);
    }
  };

  const isTranslated = activeLanguage !== 'English';
  const displayData = isTranslated ? (data.translations?.[activeLanguage] || data) : data;

  const checkReadonly = () => {
    if (isTranslated) {
      alert("Translations are read-only to preserve your original English specifications. Please switch back to English to make edits.");
      return true;
    }
    return false;
  };
`;

content = content.replace("const [isGrading, setIsGrading] = useState(false);", "const [isGrading, setIsGrading] = useState(false);\n" + stateInjection);

// Add read-only checks
const updateFunctions = [
  'updateMeasurement', 'updateDetailModuleStr', 'updateDetailDesc', 'updateDetailObj',
  'addDetailToMod', 'removeDetail', 'addDetailModule', 'updateBOM', 'updateConstruction', 'updateProperty'
];

updateFunctions.forEach(fn => {
  const regex = new RegExp('(const ' + fn + ' = [^{]+\\{)', 'g');
  content = content.replace(regex, "$1\n    if (checkReadonly()) return;");
});

content = content.replace("import { gradeSize }", "import { gradeSize, translateTechPack }");

const dropdownHtml = `
          <div className="flex bg-gray-100 p-1 rounded-xl mr-2 print:hidden hidden sm:flex shrink-0">
             <button onClick={() => setViewMode('techpack')} className={\`px-4 py-1.5 rounded-lg text-xs font-bold transition-all \${viewMode === 'techpack' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}\`}>Tech Pack</button>
             <button onClick={() => setViewMode('linesheet')} className={\`px-4 py-1.5 rounded-lg text-xs font-bold transition-all \${viewMode === 'linesheet' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}\`}>Line Sheet</button>
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm mr-2 print:hidden">
            <span className="text-[10px] uppercase font-bold text-gray-400">Language:</span>
            <select 
              className="text-xs font-bold text-gray-900 bg-transparent outline-none cursor-pointer w-24"
              value={activeLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={isTranslating}
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            {isTranslating && <div className="w-3 h-3 border-2 border-gray-200 border-t-black rounded-full animate-spin" />}
          </div>
`;

content = content.replace(/<div className="flex bg-gray-100 p-1 rounded-xl mr-2 print:hidden hidden sm:flex shrink-0">[\s\S]*?<\/div>/, dropdownHtml);

const renderSplitIndex = content.indexOf('return (');
if (renderSplitIndex !== -1) {
  let topHalf = content.substring(0, renderSplitIndex);
  let bottomHalf = content.substring(renderSplitIndex);

  bottomHalf = bottomHalf.replace(/data\?/g, 'displayData?');
  bottomHalf = bottomHalf.replace(/data\./g, 'displayData.');
  bottomHalf = bottomHalf.replace(/setData/g, 'setData'); // no-op

  content = topHalf + bottomHalf;
}

fs.writeFileSync(path, content, 'utf8');
console.log('Script completed.');
