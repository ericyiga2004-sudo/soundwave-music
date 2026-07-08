export const increasePreference = (
    list,
    key,
    value,
    amount = 1
  ) => {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return;
    }
  
    const item = list.find(
      (i) => i[key]?.toString() === value.toString()
    );
  
    if (item) {
      item.score += amount;
    } else {
      list.push({
        [key]: value,
        score: amount,
      });
    }
  };
  
  export const decreasePreference = (
    list,
    key,
    value,
    amount = 1
  ) => {
    const item = list.find(
      (i) => i[key]?.toString() === value.toString()
    );
  
    if (!item) return;
  
    item.score = Math.max(0, item.score - amount);
  };