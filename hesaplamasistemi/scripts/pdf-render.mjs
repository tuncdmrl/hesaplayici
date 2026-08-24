/** PDF çıktısını tarayıcı olmadan üretir (görsel kontrol için). */
import { writeFileSync } from 'node:fs'
import { PlanInput } from '../src/domain/PlanInput.js'
import { planService } from '../src/domain/PlanService.js'
import { PlanPdfDocument } from '../src/services/pdf/PlanPdfDocument.js'

const plan = planService.createPlan(
  new PlanInput({
    mode: 'delivery',
    assetType: 'home',
    targetAmount: 1_500_000_00,
    downPayment: 150_000_00,
    desiredDeliveryMonth: 18,
    afterDelivery: { type: 'same' },
    planStartMonth: '2026-08',
  }),
)

const document = new PlanPdfDocument(plan)
const buffer = document.build().output('arraybuffer')
const target = process.argv[2] ?? 'plan.pdf'
writeFileSync(target, Buffer.from(buffer))
console.log('yazıldı:', target, document.fileName, `${(buffer.byteLength / 1024).toFixed(0)} KB`)
