"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

interface Member {
  id: string
  memberId: string
  name: string
  totalSavings: number
  totalLoans: number
}

interface SavingsTransaction {
  id: string
  memberName: string
  amount: number
  type: "deposit" | "withdrawal"
  date: string
}

interface Loan {
  id: string
  loanId: string
  memberName: string
  totalAmount: number
  remainingAmount: number
  status: string
  issueDate: string
}

interface Expense {
  id: string
  description: string
  amount: number
  date: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  const [savingsTransactions, setSavingsTransactions] = useState<SavingsTransaction[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])

  useEffect(() => {
    const auth = localStorage.getItem("ngo_auth")
    if (!auth) {
      router.push("/")
      return
    }

    const savedMembers = localStorage.getItem("ngo_members")
    const savedSavings = localStorage.getItem("ngo_savings")
    const savedLoans = localStorage.getItem("ngo_loans")
    const savedExpenses = localStorage.getItem("ngo_expenses")

    if (savedMembers) setMembers(JSON.parse(savedMembers))
    if (savedSavings) setSavingsTransactions(JSON.parse(savedSavings))
    if (savedLoans) setLoans(JSON.parse(savedLoans))
    if (savedExpenses) setExpenses(JSON.parse(savedExpenses))

    setIsLoading(false)
  }, [router])

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  const totalMembers = members.length
  const activeMembers = members.filter((m) => m.totalSavings > 0 || m.totalLoans > 0).length
  const totalSavings = members.reduce((sum, m) => sum + m.totalSavings, 0)
  const totalLoansOutstanding = loans.reduce((sum, l) => sum + l.remainingAmount, 0)
  const activeLoans = loans.filter((l) => l.status === "active").length
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const netBalance = totalSavings - totalLoansOutstanding - totalExpenses

  const stats = [
    {
      title: "Total Members",
      value: totalMembers.toString(),
      change: `${activeMembers} active`,
      icon: "👥",
    },
    {
      title: "Total Savings",
      value: `$${totalSavings.toFixed(2)}`,
      change: `${savingsTransactions.filter((t) => t.type === "deposit").length} deposits`,
      icon: "💰",
    },
    {
      title: "Outstanding Loans",
      value: `$${totalLoansOutstanding.toFixed(2)}`,
      change: `${activeLoans} active loans`,
      icon: "🏦",
    },
    {
      title: "Net Balance",
      value: `$${netBalance.toFixed(2)}`,
      change: netBalance >= 0 ? "Positive" : "Negative",
      icon: "📊",
    },
  ]

  const recentSavings = savingsTransactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  const recentLoans = loans
    .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())
    .slice(0, 5)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of your NGO member activities and finances</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
                <span className="text-2xl">{stat.icon}</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <p className="text-xs text-gray-600 mt-1">{stat.change}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Savings Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {recentSavings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No savings transactions yet. Add transactions from the Savings page.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentSavings.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between py-2 border-b border-gray-100"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{transaction.memberName}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(transaction.date).toLocaleDateString()} - {transaction.type}
                        </div>
                      </div>
                      <div
                        className={`font-semibold ${transaction.type === "deposit" ? "text-emerald-600" : "text-orange-600"}`}
                      >
                        {transaction.type === "deposit" ? "+" : "-"}${transaction.amount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Loans</CardTitle>
            </CardHeader>
            <CardContent>
              {recentLoans.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No loans yet. Issue loans from the Loans page.</div>
              ) : (
                <div className="space-y-3">
                  {recentLoans.map((loan) => (
                    <div key={loan.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                      <div>
                        <div className="font-medium text-gray-900">
                          {loan.memberName} ({loan.loanId})
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(loan.issueDate).toLocaleDateString()} - {loan.status}
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-right">${loan.totalAmount.toFixed(2)}</div>
                        <div className="text-sm text-orange-600 text-right">
                          Remaining: ${loan.remainingAmount.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Members by Savings</CardTitle>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No members yet. Add members to get started.</div>
              ) : (
                <div className="space-y-3">
                  {members
                    .sort((a, b) => b.totalSavings - a.totalSavings)
                    .slice(0, 5)
                    .map((member) => (
                      <div key={member.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                        <div>
                          <div className="font-medium text-gray-900">{member.name}</div>
                          <div className="text-sm text-gray-500">{member.memberId}</div>
                        </div>
                        <div className="font-semibold text-emerald-600">${member.totalSavings.toFixed(2)}</div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No expenses yet. Track expenses from the Expenses page.
                </div>
              ) : (
                <div className="space-y-3">
                  {expenses
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 5)
                    .map((expense) => (
                      <div key={expense.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                        <div>
                          <div className="font-medium text-gray-900">{expense.description}</div>
                          <div className="text-sm text-gray-500">{new Date(expense.date).toLocaleDateString()}</div>
                        </div>
                        <div className="font-semibold text-red-600">${expense.amount.toFixed(2)}</div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
