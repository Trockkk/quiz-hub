import raw from '../../data/quiz-general.json'
import { parseBank } from './logic'

export const bank = parseBank(raw)
