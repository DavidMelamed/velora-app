import { useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Pressable,
} from 'react-native'
import { api } from '../../lib/api'
import type { CrashSearchResult } from '../../lib/api'
import { SearchResult } from '../../components/SearchResult'
import { colors, spacing, fontSize, borderRadius } from '../../lib/theme'

export default function SearchScreen() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CrashSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim()
    if (!trimmed) return

    Keyboard.dismiss()

    // Cancel previous request
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError(null)
    setHasSearched(true)

    try {
      const response = await api.search(trimmed, { signal: controller.signal })
      if (!controller.signal.aborted) {
        setResults(response.results)
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') return
      const message = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Search failed. Please try again.'
      if (!controller.signal.aborted) {
        setError(message)
        setResults([])
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [query])

  const suggestedQueries = [
    'Fatal crashes in Houston this month',
    'Rear-end collisions on I-95',
    'Pedestrian crashes near downtown',
    'DUI crashes in California',
  ]

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search crashes with AI..."
          placeholderTextColor={colors.text.muted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          style={[styles.searchButton, !query.trim() && styles.searchButtonDisabled]}
          onPress={handleSearch}
          disabled={!query.trim() || isLoading}
        >
          <Text style={styles.searchButtonText}>
            {isLoading ? '...' : 'Go'}
          </Text>
        </Pressable>
      </View>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Searching crashes...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!hasSearched && !isLoading && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Try searching for:</Text>
          {suggestedQueries.map((suggestion) => (
            <Pressable
              key={suggestion}
              style={styles.suggestionChip}
              onPress={() => {
                setQuery(suggestion)
                // Trigger search after setting query
                setQuery(suggestion)
              }}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {hasSearched && !isLoading && !error && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SearchResult crash={item} />}
          contentContainerStyle={styles.resultsList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptyText}>
                Try a different search query or broaden your search area.
              </Text>
            </View>
          }
          ListHeaderComponent={
            results.length > 0 ? (
              <Text style={styles.resultsCount}>
                {results.length} result{results.length !== 1 ? 's' : ''} found
              </Text>
            ) : null
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
  searchButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: colors.text.inverse,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  errorContainer: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: '#fef2f2',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.sm,
  },
  suggestionsContainer: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  suggestionsTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  suggestionChip: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    alignSelf: 'flex-start',
  },
  suggestionText: {
    color: colors.primary,
    fontSize: fontSize.sm,
  },
  resultsList: {
    padding: spacing.md,
  },
  resultsCount: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
})
