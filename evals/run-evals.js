require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { triageMessage, PROMPT_VERSION } = require('../src/llm/triage');
const { clearCache } = require('../src/llm/cache');

async function runEvaluations() {
    const casesPath = path.join(__dirname, 'cases.json');
    const testCases = JSON.parse(fs.readFileSync(casesPath, 'utf-8'));

    console.log(`\n======================================================`);
    console.log(`  FlyRank AI Evaluation Benchmark`);
    console.log(`  Prompt Version : triage-${PROMPT_VERSION}.md`);
    console.log(`  Model Provider : ${process.env.LLM_MODEL || 'openrouter/free'}`);
    console.log(`  Total Cases    : ${testCases.length}`);
    console.log(`  Date           : ${new Date().toISOString()}`);
    console.log(`======================================================\n`);

    clearCache(); // Ensure fresh evaluation runs without cached short-circuiting

    let categoryMatches = 0;
    let urgencyMatches = 0;
    const failures = [];
    const resultsTable = [];

    const startTime = Date.now();

    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        process.stdout.write(`[${i + 1}/${testCases.length}] Testing Case #${tc.id} (${tc.name})... `);

        const caseStart = Date.now();
        const response = await triageMessage(tc.input);
        const caseDuration = Date.now() - caseStart;

        if (response.status !== 200 || !response.data) {
            console.log(`❌ FAILED (Status ${response.status})`);
            failures.push({
                id: tc.id,
                name: tc.name,
                reason: `HTTP ${response.status}: ${JSON.stringify(response.data)}`
            });
            continue;
        }

        const data = response.data;
        const catMatch = data.category === tc.expected.category;
        const urgMatch = data.urgency === tc.expected.urgency;

        if (catMatch) categoryMatches++;
        if (urgMatch) urgencyMatches++;

        const statusIcon = catMatch ? '✅' : '❌';
        console.log(`${statusIcon} Category: [Got: ${data.category} | Exp: ${tc.expected.category}] (${caseDuration}ms)`);

        resultsTable.push({
            id: tc.id,
            name: tc.name,
            expected_category: tc.expected.category,
            actual_category: data.category,
            expected_urgency: tc.expected.urgency,
            actual_urgency: data.urgency,
            confidence: data.confidence,
            category_match: catMatch,
            duration_ms: caseDuration
        });

        if (!catMatch) {
            failures.push({
                id: tc.id,
                name: tc.name,
                input: tc.input,
                expected: tc.expected,
                actual: data,
                reason: `Expected category '${tc.expected.category}', received '${data.category}'`
            });
        }
    }

    const totalDuration = Date.now() - startTime;
    const accuracyPercent = ((categoryMatches / testCases.length) * 100).toFixed(1);
    const urgencyPercent = ((urgencyMatches / testCases.length) * 100).toFixed(1);

    console.log(`\n======================================================`);
    console.log(`  EVALUATION SUMMARY`);
    console.log(`======================================================`);
    console.log(`  Category Accuracy : ${categoryMatches}/${testCases.length} (${accuracyPercent}%)`);
    console.log(`  Urgency Accuracy  : ${urgencyMatches}/${testCases.length} (${urgencyPercent}%)`);
    console.log(`  Total Benchmark   : ${totalDuration}ms (avg ${(totalDuration / testCases.length).toFixed(0)}ms/req)`);

    if (failures.length > 0) {
        console.log(`\n  Discrepancies / Mismatches (${failures.length}):`);
        failures.forEach(f => {
            console.log(`   - [#${f.id} ${f.name}]: ${f.reason}`);
        });
    } else {
        console.log(`\n  🎉 Perfect score! 100% agreement on primary category.`);
    }
    console.log(`======================================================\n`);

    return {
        total: testCases.length,
        categoryMatches,
        accuracyPercent,
        urgencyMatches,
        urgencyPercent,
        failures,
        resultsTable
    };
}

if (require.main === module) {
    runEvaluations().catch(err => {
        console.error("Eval runner execution error:", err);
        process.exit(1);
    });
}

module.exports = { runEvaluations };
