import { render, screen } from '@testing-library/react'
import { ThemeToggle } from './theme-toggle'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
  }),
}))

describe('ThemeToggle', () => {
  it('renders without crashing', async () => {
    render(<ThemeToggle />)
    const button = await screen.findByLabelText('Toggle theme')
    expect(button).toBeInTheDocument()
  })
})
