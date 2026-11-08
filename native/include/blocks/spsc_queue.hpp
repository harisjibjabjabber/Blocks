#pragma once

#include <atomic>
#include <cstddef>
#include <cstdint>
#include <type_traits>

namespace blocks {

// Single-producer single-consumer ring. Capacity is fixed and includes one
// unused slot, so the usable depth is Capacity - 1. Indices are atomics.
// This queue is the only handoff the audio callback is allowed to touch.
template <typename T, size_t Capacity>
class SpscQueue {
 public:
  static_assert(Capacity >= 2, "capacity");
  static_assert((Capacity & (Capacity - 1)) == 0, "capacity must be a power of two");
  static_assert(std::is_trivially_copyable<T>::value, "slot type must be trivially copyable");

  static constexpr size_t kCapacity = Capacity;
  static constexpr size_t kUsable = Capacity - 1;

  bool push(const T& item) {
    const uint32_t write = write_.load(std::memory_order_relaxed);
    const uint32_t next = (write + 1u) & mask_;
    if (next == read_.load(std::memory_order_acquire)) {
      return false;
    }
    slots_[write] = item;
    write_.store(next, std::memory_order_release);
    return true;
  }

  bool peek(T& out) const {
    const uint32_t read = read_.load(std::memory_order_relaxed);
    if (read == write_.load(std::memory_order_acquire)) {
      return false;
    }
    out = slots_[read];
    return true;
  }

  void pop() {
    const uint32_t read = read_.load(std::memory_order_relaxed);
    read_.store((read + 1u) & mask_, std::memory_order_release);
  }

  bool pop(T& out) {
    if (!peek(out)) {
      return false;
    }
    pop();
    return true;
  }

  uint32_t sizeApprox() const {
    const uint32_t write = write_.load(std::memory_order_acquire);
    const uint32_t read = read_.load(std::memory_order_acquire);
    return (write - read) & mask_;
  }

 private:
  static constexpr uint32_t mask_ = static_cast<uint32_t>(Capacity - 1);
  T slots_[Capacity]{};
  std::atomic<uint32_t> write_{0};
  std::atomic<uint32_t> read_{0};
};

}  // namespace blocks
