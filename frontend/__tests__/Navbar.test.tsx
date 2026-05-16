import { render, screen } from '@testing-library/react'
import Navbar from '@/components/Navbar'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/',
}))

test('renders Movora logo', () => {
  const { container } = render(<Navbar />)
  expect(container.querySelector('a[href="/"]')).toBeTruthy()
})

test('renders Movies nav link', () => {
  render(<Navbar />)
  expect(screen.getByRole('link', { name: /movies/i })).toBeInTheDocument()
})
