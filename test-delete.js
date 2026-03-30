async function test() {
    const res = await fetch("http://localhost:3000/api/sandbox-vuelos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyId: "testing-123" }) // Fake ID to trigger the endpoint
    });
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
}
test();
