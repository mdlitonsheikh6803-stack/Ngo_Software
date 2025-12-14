"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

interface Member {
  id: string
  memberId: string
  name: string
  totalSavings: number
}

interface SavingsTransaction {
  id: string
  memberId: string
  memberName: string
  amount: number
  type: "deposit" | "withdrawal"
  date: string
  description: string
}

export default function SavingsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  const [transactions, setTransactions] = useState<SavingsTransaction[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    memberId: "",
    amount: "",
    type: "deposit" as "deposit" | "withdrawal",
    description: "",
  })

  useEffect(() => {
    const auth = localStorage.getItem("ngo_auth")
    if (!auth) {
      router.push("/")
      return
    }

    const savedMembers = localStorage.getItem("ngo_members")
    const savedTransactions = localStorage.getItem("ngo_savings")

    if (savedMembers) setMembers(JSON.parse(savedMembers))
    if (savedTransactions) setTransactions(JSON.parse(savedTransactions))

    setIsLoading(false)
  }, [router])

  const handleAddTransaction = () => {
    const member = members.find((m) => m.id === formData.memberId)
    if (!member) return

    const amount = Number.parseFloat(formData.amount)
    const newTransaction: SavingsTransaction = {
      id: Date.now().toString(),
      memberId: member.id,
      memberName: member.name,
      amount,
      type: formData.type,
      date: new Date().toISOString(),
      description: formData.description,
    }

    const updatedTransactions = [...transactions, newTransaction]
    setTransactions(updatedTransactions)
    localStorage.setItem("ngo_savings", JSON.stringify(updatedTransactions))

    // Update member's total savings
    const updatedMembers = members.map((m) => {
      if (m.id === member.id) {
        return {
          ...m,
          totalSavings: formData.type === "deposit" ? m.totalSavings + amount : Math.max(0, m.totalSavings - amount),
        }
      }
      return m
    })
    setMembers(updatedMembers)
    localStorage.setItem("ngo_members", JSON.stringify(updatedMembers))

    setFormData({ memberId: "", amount: "", type: "deposit", description: "" })
    setIsDialogOpen(false)
  }

  const filteredTransactions = transactions.filter(
    (t) =>
      t.memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const totalSavings = members.reduce((sum, m) => sum + m.totalSavings, 0)
  const totalDeposits = transactions.filter((t) => t.type === "deposit").reduce((sum, t) => sum + t.amount, 0)
  const totalWithdrawals = transactions.filter((t) => t.type === "withdrawal").reduce((sum, t) => sum + t.amount, 0)

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Savings Management</h1>
            <p className="text-gray-600 mt-1">Track member savings deposits and withdrawals</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">Add Transaction</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Savings Transaction</DialogTitle>
                <DialogDescription>Record a deposit or withdrawal for a member</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="member">Select Member</Label>
                  <Select
                    value={formData.memberId}
                    onValueChange={(value) => setFormData({ ...formData, memberId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name} ({member.memberId}) - Balance: ${member.totalSavings.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Transaction Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: "deposit" | "withdrawal") => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deposit">Deposit</SelectItem>
                      <SelectItem value="withdrawal">Withdrawal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ($)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Monthly savings deposit"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddTransaction} disabled={!formData.memberId || !formData.amount}>
                  Add Transaction
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Savings</CardTitle>
              <span className="text-2xl">💰</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">${totalSavings.toFixed(2)}</div>
              <p className="text-xs text-gray-600 mt-1">All members combined</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Deposits</CardTitle>
              <span className="text-2xl">📈</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">${totalDeposits.toFixed(2)}</div>
              <p className="text-xs text-gray-600 mt-1">
                {transactions.filter((t) => t.type === "deposit").length} transactions
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Withdrawals</CardTitle>
              <span className="text-2xl">📉</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">${totalWithdrawals.toFixed(2)}</div>
              <p className="text-xs text-gray-600 mt-1">
                {transactions.filter((t) => t.type === "withdrawal").length} transactions
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>Transaction History ({filteredTransactions.length})</CardTitle>
              <Input
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="sm:w-64"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No transactions yet. Add your first savings transaction.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Member</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Type</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Amount</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((transaction) => (
                        <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-gray-700">{new Date(transaction.date).toLocaleDateString()}</td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">{transaction.memberName}</div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={transaction.type === "deposit" ? "default" : "secondary"}>
                              {transaction.type}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div
                              className={`font-semibold ${transaction.type === "deposit" ? "text-emerald-600" : "text-orange-600"}`}
                            >
                              {transaction.type === "deposit" ? "+" : "-"}${transaction.amount.toFixed(2)}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-700">{transaction.description}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
