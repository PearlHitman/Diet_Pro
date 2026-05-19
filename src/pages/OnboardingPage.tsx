// Onboarding — 5-step first-run wizard.
// Steps: Welcome → Language → API key → About you → First ingredient
//
// Self-contained: holds its own i18n strings inline (OB_TEXT) so it
// doesn't depend on adding new keys to your i18n.ts. The language is
// chosen in step 1 and propagated through subsequent steps.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Chrome';
import { Field, Input, Segmented, PrimaryButton, GhostButton, Stepper } from '../components/Forms';
import { T, SCREEN_PAD_TOP } from '../tokens';
import { ChefHat, ArrowRight, ArrowLeft, Sparkles, Check, X, AlertCircle } from '../components/Icons';
import { useApp } from '../lib/app-state';
import { validateApiKey } from '../lib/claude';
import { markOnboarded } from '../lib/onboarding-state';
import { CATEGORIES, type Category, type Ingredient, type Language, type Level } from '../lib/types';

// ─── Inline i18n for onboarding ──────────────────────────────

const OB = {
  EL: {
    welcomeTitle: 'Καλώς ήρθες στο Mise',
    tagline: 'Όλα στη θέση τους.',
    welcomeBody: 'Μετατρέπουμε αυτά που έχεις σε κάτι νόστιμο. Ας στήσουμε τα βασικά — παίρνει ένα λεπτό.',
    getStarted: 'Ξεκίνα',
    chooseLanguage: 'Επίλεξε γλώσσα',
    chooseLanguageHint: 'Αλλάζει ανά πάσα στιγμή από το προφίλ.',
    connectAI: 'Σύνδεση με Claude',
    connectAIBody: 'Το Mise χρησιμοποιεί τον Claude της Anthropic για συνταγές. Το κλειδί σου αποθηκεύεται μόνο σε αυτόν τον browser — δεν στέλνεται πουθενά εκτός Anthropic.',
    apiKey: 'Κλειδί API',
    keyPlaceholder: 'sk-ant-...',
    testKey: 'Δοκιμή κλειδιού',
    validating: 'Επαλήθευση…',
    keyValid: 'Έγκυρο',
    keyInvalid: 'Άκυρο',
    getKey: 'Πάρε κλειδί από το console.anthropic.com',
    aboutYou: 'Λίγα για σένα',
    aboutYouHint: 'Βοηθάει το Mise να σου προτείνει πιο σχετικά πράγματα. Μπορείς να τα συμπληρώσεις αργότερα.',
    yourName: 'Το όνομά σου',
    cuisine: 'Αγαπημένη κουζίνα',
    level: 'Επίπεδο μαγειρικής',
    beginner: 'Αρχάριος',
    intermediate: 'Μεσαίος',
    expert: 'Προχωρημένος',
    servings: 'Μερίδες',
    firstIngredient: 'Το πρώτο σου υλικό',
    firstIngredientHint: 'Πρόσθεσε κάτι που έχεις τώρα. Χρειαζόμαστε τουλάχιστον ένα για τις συνταγές.',
    name: 'Όνομα',
    category: 'Κατηγορία',
    expiryDate: 'Ημ. λήξης',
    expiryHint: 'Προαιρετικό — βοηθά στην προτεραιότητα.',
    cat_produce: 'Φρούτα/Λαχ.',
    cat_protein: 'Πρωτεΐνη',
    cat_dairy: 'Γαλακτοκ.',
    cat_grains: 'Δημητρ.',
    cat_pantry: 'Ντουλάπι',
    cat_other: 'Άλλο',
    skip: 'Όχι τώρα',
    continue: 'Συνέχεια',
    finish: 'Έτοιμοι — μπες στο Mise',
  },
  EN: {
    welcomeTitle: 'Welcome to Mise',
    tagline: 'Everything in its place.',
    welcomeBody: "Turn what you already have into something delicious. Let's set things up — it takes a minute.",
    getStarted: 'Get started',
    chooseLanguage: 'Choose your language',
    chooseLanguageHint: 'You can change this anytime in your profile.',
    connectAI: 'Connect Claude',
    connectAIBody: "Mise uses Anthropic's Claude to suggest recipes. Your API key is stored only in this browser — never sent anywhere except Anthropic.",
    apiKey: 'API key',
    keyPlaceholder: 'sk-ant-...',
    testKey: 'Test key',
    validating: 'Validating…',
    keyValid: 'Valid',
    keyInvalid: 'Invalid',
    getKey: 'Get a key from console.anthropic.com',
    aboutYou: 'About you',
    aboutYouHint: 'This helps Mise tailor suggestions to your taste. You can skip and add later.',
    yourName: 'Your name',
    cuisine: 'Preferred cuisine',
    level: 'Cooking level',
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    expert: 'Expert',
    servings: 'Servings',
    firstIngredient: 'Your first ingredient',
    firstIngredientHint: 'Add something you have in the kitchen right now. We need at least one to generate recipes.',
    name: 'Name',
    category: 'Category',
    expiryDate: 'Expiry date',
    expiryHint: 'Optional — helps prioritize.',
    cat_produce: 'Produce',
    cat_protein: 'Protein',
    cat_dairy: 'Dairy',
    cat_grains: 'Grains',
    cat_pantry: 'Pantry',
    cat_other: 'Other',
    skip: 'Skip for now',
    continue: 'Continue',
    finish: 'Done — enter Mise',
  },
  ES: {
    welcomeTitle: 'Bienvenido a Mise',
    tagline: 'Todo en su lugar.',
    welcomeBody: 'Convierte lo que ya tienes en algo delicioso. Vamos a configurarlo — es un momento.',
    getStarted: 'Empezar',
    chooseLanguage: 'Elige tu idioma',
    chooseLanguageHint: 'Puedes cambiarlo en cualquier momento desde tu perfil.',
    connectAI: 'Conectar Claude',
    connectAIBody: 'Mise usa Claude de Anthropic para sugerir recetas. Tu clave API se almacena solo en este navegador — nunca se envía a ningún lugar excepto Anthropic.',
    apiKey: 'Clave API',
    keyPlaceholder: 'sk-ant-...',
    testKey: 'Probar clave',
    validating: 'Validando…',
    keyValid: 'Válida',
    keyInvalid: 'Inválida',
    getKey: 'Obtén una clave en console.anthropic.com',
    aboutYou: 'Sobre ti',
    aboutYouHint: 'Esto ayuda a Mise a adaptar las sugerencias a tu gusto. Puedes omitirlo y añadirlo más tarde.',
    yourName: 'Tu nombre',
    cuisine: 'Cocina preferida',
    level: 'Nivel de cocina',
    beginner: 'Principiante',
    intermediate: 'Intermedio',
    expert: 'Experto',
    servings: 'Raciones',
    firstIngredient: 'Tu primer ingrediente',
    firstIngredientHint: 'Añade algo que tengas ahora en la cocina. Necesitamos al menos uno para generar recetas.',
    name: 'Nombre',
    category: 'Categoría',
    expiryDate: 'Fecha de caducidad',
    expiryHint: 'Opcional — ayuda a priorizar.',
    cat_produce: 'Frutas/Verd.',
    cat_protein: 'Proteína',
    cat_dairy: 'Lácteos',
    cat_grains: 'Cereales',
    cat_pantry: 'Despensa',
    cat_other: 'Otro',
    skip: 'Omitir por ahora',
    continue: 'Continuar',
    finish: 'Listo — entrar a Mise',
  },
} as const;

type Step = 0 | 1 | 2 | 3 | 4;
const STEPS_TOTAL = 5;
type KeyState = 'unchecked' | 'checking' | 'valid' | 'invalid';

// ─── Component ───────────────────────────────────────────────

export function OnboardingPage({ onComplete }: { onComplete: () => void }) {
  const { profile, saveProfile, settings, saveSettings, addIngredient } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(0);
  const [language, setLanguage] = useState<Language>(profile.language);
  const ob = OB[language];

  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [keyState, setKeyState] = useState<KeyState>(settings.apiKey ? 'valid' : 'unchecked');
  const [keyError, setKeyError] = useState('');

  const [name, setName] = useState(profile.name);
  const [cuisine, setCuisine] = useState(profile.cuisine);
  const [level, setLevel] = useState<Level>(profile.level);
  const [servings, setServings] = useState(profile.servings);

  const [ingName, setIngName] = useState('');
  const [ingCat, setIngCat] = useState<Category>('produce');
  const [ingExpiry, setIngExpiry] = useState('');

  async function chooseLanguage(lang: Language) {
    setLanguage(lang);
    await saveProfile({ ...profile, language: lang });
  }

  async function testKey() {
    setKeyState('checking'); setKeyError('');
    const r = await validateApiKey(apiKey);
    if (r.ok) {
      setKeyState('valid');
      await saveSettings({ ...settings, apiKey });
    } else {
      setKeyState('invalid');
      setKeyError(r.reason);
    }
  }

  const goNext = () => setStep(s => Math.min(STEPS_TOTAL - 1, s + 1) as Step);
  const goBack = () => setStep(s => Math.max(0, s - 1) as Step);

  async function finish() {
    await saveProfile({ ...profile, language, name: name.trim(), cuisine: cuisine.trim(), level, servings });
    if (ingName.trim()) {
      const ing: Ingredient = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: ingName.trim(),
        category: ingCat,
        expiresOn: ingExpiry || null,
        addedAt: new Date().toISOString(),
      };
      await addIngredient(ing);
    }
    await markOnboarded();
    onComplete();
    navigate('/', { replace: true });
  }

  return (
    <Screen>
      {step > 0 && (
        <div style={{ padding: '6px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={goBack} style={{
            width: 30, height: 30, borderRadius: 8, border: 'none',
            background: 'transparent', color: T.text2, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><ArrowLeft size={16} /></button>
          <div style={{ flex: 1, display: 'flex', gap: 4 }}>
            {Array.from({ length: STEPS_TOTAL - 1 }, (_, i) => (
              <div key={i} style={{
                flex: 1, height: 3, borderRadius: 999,
                background: i + 1 <= step ? T.accent : 'rgba(255,255,255,0.08)',
                transition: 'background 0.2s',
              }}/>
            ))}
          </div>
          <div style={{ fontSize: 11, color: T.muted, fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>
            {step}/{STEPS_TOTAL - 1}
          </div>
        </div>
      )}

      <div style={{
        padding: '24px 24px 28px',
        minHeight: `calc(100vh - ${SCREEN_PAD_TOP} - 40px)`,
        display: 'flex', flexDirection: 'column',
      }}>
        {step === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 22,
              background: T.accentTint, border: `1px solid ${T.borderAcc}`, color: T.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28,
            }}><ChefHat size={36} /></div>
            <div style={{ fontSize: 28, fontWeight: 700, color: T.text, letterSpacing: -0.6, marginBottom: 8 }}>
              {ob.welcomeTitle}
            </div>
            <div style={{ fontSize: 14, color: T.accent, fontStyle: 'italic', marginBottom: 22, letterSpacing: 0.3 }}>
              {ob.tagline}
            </div>
            <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.6, maxWidth: 320, marginBottom: 40 }}>
              {ob.welcomeBody}
            </div>
            <PrimaryButton onClick={goNext} icon={<ArrowRight size={16} />}>{ob.getStarted}</PrimaryButton>
          </div>
        )}

        {step === 1 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <StepHeader title={ob.chooseLanguage} hint={ob.chooseLanguageHint} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 }}>
              <LangTile flag="🇬🇷" label="Ελληνικά" sub="Greek" selected={language === 'EL'} onClick={() => chooseLanguage('EL')} />
              <LangTile flag="🇬🇧" label="English" sub="English" selected={language === 'EN'} onClick={() => chooseLanguage('EN')} />
              <LangTile flag="🇪🇸" label="Español" sub="Spanish (Spain)" selected={language === 'ES'} onClick={() => chooseLanguage('ES')} />
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 32 }}>
              <PrimaryButton onClick={goNext} fullWidth icon={<ArrowRight size={16} />}>{ob.continue}</PrimaryButton>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <StepHeader title={ob.connectAI} hint={ob.connectAIBody} />
            <div style={{ marginTop: 24 }}>
              <Field label={ob.apiKey}>
                <Input value={apiKey} onChange={v => { setApiKey(v); setKeyState('unchecked'); }} placeholder={ob.keyPlaceholder} type="password" />
              </Field>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: -8 }}>
                <PrimaryButton onClick={testKey} disabled={!apiKey || keyState === 'checking'}>
                  {keyState === 'checking' ? ob.validating : ob.testKey}
                </PrimaryButton>
                {keyState === 'valid' && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 999, background: T.successTint, border: `1px solid ${T.successBord}`, color: T.success, fontSize: 11, fontWeight: 600 }}>
                    <Check size={12} />{ob.keyValid}
                  </span>
                )}
                {keyState === 'invalid' && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 999, background: T.dangerTint, border: '1px solid rgba(248,113,113,0.3)', color: T.danger, fontSize: 11, fontWeight: 600 }}>
                    <X size={12} />{ob.keyInvalid}
                  </span>
                )}
              </div>
              {keyError && (
                <div style={{ marginTop: 12, fontSize: 12, color: T.danger, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={13} color={T.danger} />{keyError}
                </div>
              )}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 18, color: T.accent, fontSize: 13, textDecoration: 'none' }}>→ {ob.getKey}</a>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 32 }}>
              <PrimaryButton onClick={goNext} disabled={keyState !== 'valid'} fullWidth icon={<ArrowRight size={16} />}>{ob.continue}</PrimaryButton>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <StepHeader title={ob.aboutYou} hint={ob.aboutYouHint} />
            <div style={{ marginTop: 24 }}>
              <Field label={ob.yourName}><Input value={name} onChange={setName} autoFocus /></Field>
              <Field label={ob.cuisine}><Input value={cuisine} onChange={setCuisine} placeholder="Mediterranean" /></Field>
              <Field label={ob.level}>
                <Segmented<Level> value={level} onChange={setLevel} options={[
                  { value: 'Beginner', label: ob.beginner },
                  { value: 'Intermediate', label: ob.intermediate },
                  { value: 'Expert', label: ob.expert },
                ]} />
              </Field>
              <Field label={ob.servings}><Stepper value={servings} onChange={setServings} min={1} max={12} /></Field>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 32, display: 'flex', gap: 10 }}>
              <GhostButton onClick={goNext}>{ob.skip}</GhostButton>
              <PrimaryButton onClick={goNext} fullWidth icon={<ArrowRight size={16} />}>{ob.continue}</PrimaryButton>
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <StepHeader title={ob.firstIngredient} hint={ob.firstIngredientHint} />
            <div style={{ marginTop: 24 }}>
              <Field label={ob.name}><Input value={ingName} onChange={setIngName} placeholder="Chicken breast" autoFocus /></Field>
              <Field label={ob.category}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {CATEGORIES.map(c => (
                    <button key={c} type="button" onClick={() => setIngCat(c)} style={{
                      padding: '8px 14px', borderRadius: 999,
                      background: ingCat === c ? T.accentTint : T.surface,
                      border: `1px solid ${ingCat === c ? T.borderAcc : T.border}`,
                      color: ingCat === c ? T.accent : T.text2,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: T.font,
                    }}>{ob[`cat_${c}` as const]}</button>
                  ))}
                </div>
              </Field>
              <Field label={ob.expiryDate} hint={ob.expiryHint}>
                <Input value={ingExpiry} onChange={setIngExpiry} type="date" />
              </Field>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 32, display: 'flex', gap: 10 }}>
              <GhostButton onClick={finish}>{ob.skip}</GhostButton>
              <PrimaryButton onClick={finish} fullWidth icon={<Sparkles size={16} />}>{ob.finish}</PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </Screen>
  );
}

function LangTile({ flag, label, sub, selected, onClick }: { flag: string; label: string; sub: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '16px 18px',
      background: selected ? T.accentTint : T.surface,
      border: `1px solid ${selected ? T.borderAcc : T.border}`,
      borderRadius: 14, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', fontFamily: T.font,
    }}>
      <div style={{ fontSize: 28 }}>{flag}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: selected ? T.accent : T.text }}>{label}</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{sub}</div>
      </div>
      {selected && <Check size={18} color={T.accent} />}
    </button>
  );
}

function StepHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 700, color: T.text, letterSpacing: -0.5, marginBottom: 8 }}>{title}</div>
      {hint && <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.55 }}>{hint}</div>}
    </div>
  );
}
