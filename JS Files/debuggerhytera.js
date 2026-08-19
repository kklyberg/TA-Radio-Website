function testUpdateContent() {
  const result = updateInventoryContent({
    model: "BD502i-V1",  // use a model you know exists
    brand: "Hytera",
    type: "portable",
    features: "Test feature A, Test feature B",
    specTable: "{\"Power\":\"5W\"}",
    "short-description": "Test description",
    "catalog-copy": "Test catalog line",
    "root-model": "BD502i"
  });
  Logger.log(JSON.stringify(result));
}