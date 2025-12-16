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
import { createClient } from "@/lib/supabase/client"

interface Member {
  id: string
  member_id: string
  name: string
  total_savings: number
}

interface SavingsTransaction {
  id: string
  member_id: string
  amount: number
  type: "deposit" | "withdrawal"
  payment_method: string
  description: string
  transaction_date: string
  members?: { name: string }
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
    paymentMethod: "cash",
    description: "",
  })
  const supabase = createClient()

  const loadData = async () => {
    const [membersResult, transactionsResult] = await Promise.all([
      supabase.from("members").select("id, member_id, name, total_savings").order("name"),
      supabase.from("savings_transactions").select("*, members(name)").order("transaction_date", { ascending: false }),
    ])

    if (membersResult.error) {
      console.error("[v0] Error loading members:", membersResult.error)
    } else {
      setMembers(membersResult.data || [])
    }

    if (transactionsResult.error) {
      console.error("[v0] Error loading transactions:", transactionsResult.error)
    } else {
      setTransactions(transactionsResult.data || [])
    }
  }

  useEffect(() => {
    const auth = localStorage.getItem("ngo_auth")
    if (!auth) {
      router.push("/")
      return
    }

    loadData().then(() => setIsLoading(false))
  }, [router])

  const handleAddTransaction = async () => {
    const amount = Number.parseFloat(formData.amount)

    const { error: transactionError } = await supabase.from("savings_transactions").insert({
      member_id: formData.memberId,
      type: formData.type,
      amount,
      payment_method: formData.paymentMethod,
      description: formData.description,
      transaction_date: new Date().toISOString(),
    })

    if (transactionError) {
      console.error("[v0] Error adding transaction:", transactionError)
      return
    }

    // Update member's total savings
    const member = members.find((m) => m.id === formData.memberId)
    if (member) {
      const newTotal =
        formData.type === "deposit"
          ? Number(member.total_savings) + amount
          : Math.max(0, Number(member.total_savings) - amount)

      const { error: updateError } = await supabase
        .from("members")
        .update({
          total_savings: newTotal,
          updated_at: new Date().toISOString(),
        })
        .eq("id", formData.memberId)

      if (updateError) {
        console.error("[v0] Error updating member:", updateError)
      }
    }

    await loadData()
    setFormData({ memberId: "", amount: "", type: "deposit", paymentMethod: "cash", description: "" })
    setIsDialogOpen(false)
  }

  const filteredTransactions = transactions.filter((t) => {
    const memberName = t.members?.name || ""
    return (
      memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  })

  const totalSavings = members.reduce((sum, m) => sum + Number(m.total_savings), 0)
  const totalDeposits = transactions.filter((t) => t.type === "deposit").reduce((sum, t) => sum + Number(t.amount), 0)
  const totalWithdrawals = transactions
    .filter((t) => t.type === "withdrawal")
    .reduce((sum, t) => sum + Number(t.amount), 0)

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
                          {member.name} ({member.member_id}) - Balance: ${Number(member.total_savings).toFixed(2)}
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
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select
                    value={formData.paymentMethod}
                    onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
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
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Method</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((transaction) => (
                      <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-700">
                          {new Date(transaction.transaction_date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">{transaction.members?.name}</div>
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
                            {transaction.type === "deposit" ? "+" : "-"}${Number(transaction.amount).toFixed(2)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-700">{transaction.payment_method}</td>
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
