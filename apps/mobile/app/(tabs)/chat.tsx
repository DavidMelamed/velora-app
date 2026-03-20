import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { colors, spacing, fontSize, borderRadius } from '../../lib/theme'
import { api } from '../../lib/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [matterId, setMatterId] = useState<string | null>(null)
  const listRef = useRef<FlatList<Message>>(null)

  useEffect(() => {
    loadChat()
  }, [])

  const loadChat = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default
      const storedMatterId = await AsyncStorage.getItem('velora_matter_id')
      if (!storedMatterId) return

      setMatterId(storedMatterId)
      const history = await api.getChatHistory(storedMatterId)
      setMessages((history || []).map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        createdAt: m.timestamp,
      })))
    } catch {
      // No matter or no chat history yet
    }
  }

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || !matterId || sending) return

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setSending(true)

    try {
      const allMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }))
      const res = await api.sendChatMessage(matterId, allMessages)
      if (res?.content) {
        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: 'assistant' as const,
            content: res.content,
            createdAt: new Date().toISOString(),
          },
        ])
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I could not process that. Please try again.',
          createdAt: new Date().toISOString(),
        },
      ])
    } finally {
      setSending(false)
    }
  }, [input, matterId, sending])

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user'
    return (
      <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {item.content}
          </Text>
        </View>
      </View>
    )
  }

  if (!matterId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.placeholderEmoji}>💬</Text>
        <Text style={styles.placeholderTitle}>Case Shepherd</Text>
        <Text style={styles.placeholderSubtitle}>
          Start a case to chat with your AI case assistant.
        </Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your case..."
          placeholderTextColor={colors.text.muted}
          multiline
          maxLength={2000}
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || sending}
          activeOpacity={0.7}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  placeholderEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  placeholderTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  placeholderSubtitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  messageList: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    justifyContent: 'flex-start',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: borderRadius.sm,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: colors.text.inverse,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text.primary,
    backgroundColor: colors.surface,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: colors.text.muted,
  },
  sendIcon: {
    color: colors.text.inverse,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
})
