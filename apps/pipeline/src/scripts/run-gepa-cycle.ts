#!/usr/bin/env tsx
/**
 * CLI: Run a GEPA prompt optimization cycle.
 *
 * Usage:
 *   npx tsx src/scripts/run-gepa-cycle.ts --signature narrative --variants 5 --samples 20
 *   npx tsx src/scripts/run-gepa-cycle.ts --signature equalizer --variants 3 --dry-run
 */

import { Command } from 'commander'

const program = new Command()

program
  .name('run-gepa-cycle')
  .description('Run a GEPA evolutionary prompt optimization cycle')
  .option('--signature <type>', 'Signature type: narrative, equalizer, persona', 'narrative')
  .option('--variants <n>', 'Number of variants to generate', '5')
  .option('--samples <n>', 'Number of samples to evaluate each variant', '20')
  .option('--archetype <id>', 'Optimize for a specific archetype')
  .option('--dry-run', 'Simulate without writing to database', false)
  .action(async (opts) => {
    const signature = opts.signature as 'narrative' | 'equalizer' | 'persona'
    const variants = parseInt(opts.variants, 10)
    const samples = parseInt(opts.samples, 10)
    const dryRun = opts.dryRun as boolean

    if (!['narrative', 'equalizer', 'persona'].includes(signature)) {
      console.error(`Invalid signature: ${signature}. Must be: narrative, equalizer, persona`)
      process.exit(1)
    }

    console.log(`\n=== GEPA Optimization Cycle ===`)
    console.log(`Signature: ${signature}`)
    console.log(`Variants:  ${variants}`)
    console.log(`Samples:   ${samples}`)
    console.log(`Dry run:   ${dryRun}`)
    console.log(`Archetype: ${opts.archetype || 'none (general)'}`)
    console.log(``)

    // Dynamic import to avoid loading AI dependencies at parse time
    const { runGEPACycle } = await import('@velora/ai/src/optimization/gepa-optimizer')

    const result = await runGEPACycle({
      signature,
      variants,
      samples,
      archetypeId: opts.archetype,
      dryRun,
    })

    console.log(`\n=== Results ===`)
    console.log(`Total variants: ${result.totalVariants}`)
    console.log(`Evaluated:      ${result.evaluatedVariants}`)
    console.log(`Promoted:       ${result.promoted}`)

    if (result.winner) {
      console.log(`\nWinner: v${result.winner.version}`)
      console.log(`  Composite score: ${result.winner.compositeScore.toFixed(3)}`)
      console.log(`  Dimension scores:`)
      for (const [key, value] of Object.entries(result.winner.scores)) {
        console.log(`    ${key}: ${value.toFixed(3)}`)
      }
    }

    console.log(`\nAll variants:`)
    for (const v of result.variants) {
      console.log(
        `  v${v.version}: ${v.compositeScore.toFixed(3)} [${v.mutations.join(', ')}]`,
      )
    }
  })

program.parse()
