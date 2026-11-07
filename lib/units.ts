// Ö2b: birim dönüşümleri ve biçimleme (saf). Veri her zaman metrik saklanır (kg, ml, kcal, cm); yalnız gösterim ve giriş dönüşür.
import type { Units } from './cards/style.ts'

export const LB_PER_KG = 2.2046226218
export const ML_PER_OZ = 29.5735295625
export const KJ_PER_KCAL = 4.184
export const CM_PER_IN = 2.54

const tr = (v: number, d: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d })

export const weightOut = (kg: number, u: Units['weight']) => (u === 'lb' ? kg * LB_PER_KG : kg)
export const weightIn = (v: number, u: Units['weight']) => (u === 'lb' ? v / LB_PER_KG : v)
export const fmtWeight = (kg: number, u: Units['weight'], d = 1) => `${tr(weightOut(kg, u), d)} ${u}`

export const volumeOut = (ml: number, u: Units['volume']) => (u === 'oz' ? ml / ML_PER_OZ : ml)
/** Su gibi miktarlar: ml tam sayı, oz bir ondalık. */
export const fmtVolume = (ml: number, u: Units['volume']) => (u === 'oz' ? `${tr(ml / ML_PER_OZ, 1)} oz` : `${tr(Math.round(ml), 0)} ml`)
export const volumeNum = (ml: number, u: Units['volume']) => (u === 'oz' ? tr(ml / ML_PER_OZ, 1) : tr(Math.round(ml), 0))

export const energyOut = (kcal: number, u: Units['energy']) => (u === 'kJ' ? kcal * KJ_PER_KCAL : kcal)
export const fmtEnergyNum = (kcal: number, u: Units['energy']) => tr(Math.round(energyOut(kcal, u)), 0)

export const lengthOut = (cm: number, u: Units['length']) => (u === 'in' ? cm / CM_PER_IN : cm)
export const fmtLength = (cm: number, u: Units['length']) => (u === 'in' ? `${tr(cm / CM_PER_IN, 1)} in` : `${tr(cm, 0)} cm`)
