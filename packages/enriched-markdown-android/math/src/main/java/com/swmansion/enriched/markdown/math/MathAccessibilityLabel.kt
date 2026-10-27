package com.swmansion.enriched.markdown.math

import com.swmansion.enriched.markdown.parser.LatexSpeech

internal fun mathAccessibilityLabel(latex: String): String = "Math: " + LatexSpeech.spokenForm(latex)
