export const parseJson = (s, def) => {
  try { return JSON.parse(s || ''); } catch { return def; }
};

export const parseFields = (p) => parseJson(p.fields, []);

export const parseAnswers = (o) => parseJson(o.answers, {});

export const normalizeFields = (fields) =>
  (Array.isArray(fields) ? fields : []).map((f, i) => ({
    key: f.key || `f${i}`,
    label: String(f.label || '').trim(),
    type: f.type === 'textarea' ? 'textarea' : 'text',
    required: !!f.required,
  })).filter(f => f.label);
