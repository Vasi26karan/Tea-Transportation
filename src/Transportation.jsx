import React, { useState } from "react";
import "./App.css";
import "leaflet/dist/leaflet.css";

const TeaTransportOptimizer = () => {
  const [result, setResult] = useState(null);
  const [dailyData, setDailyData] = useState({
    ayyankolly: { load: 0, labour: 0 },
    kayyunni: { load: 0, labour: 0 },
    erumad: { load: 0, labour: 0 },
    koolal: { load: 0, labour: 0 },
  });

  const [routeAvailability, setRouteAvailability] = useState({});
  const [adjustedMatrix, setAdjustedMatrix] = useState(null);

  const truckCapacity = 1300;
  const mileage = 14;
  const costPerLiter = 100;

  const originalDistanceMatrix = {
    kolappally: { ayyankolly: 5.4, kayyunni: 11.7, erumad: 12.6, koolal: 6.3 },
    ayyankolly: { kolappally: 5.4, kayyunni: 7.5, erumad: 8.5, koolal: 9.1 },
    kayyunni: { kolappally: 11.7, ayyankolly: 7.5, erumad: 4.4, koolal: 7.5 },
    erumad: { kolappally: 12.6, ayyankolly: 8.5, kayyunni: 4.4, koolal: 3.1 },
    koolal: { kolappally: 6.3, ayyankolly: 9.1, kayyunni: 7.5, erumad: 3.1 },
  };

  const getAdjustedDistanceMatrix = () => {
    const adjusted = JSON.parse(JSON.stringify(originalDistanceMatrix));
    Object.entries(routeAvailability).forEach(([fromTo, available]) => {
      if (!available) {
        const [from, to] = fromTo.split("-");
        if (adjusted[from]) adjusted[from][to] = Infinity;
        if (adjusted[to]) adjusted[to][from] = Infinity;
      }
    });
    return adjusted;
  };

  const dijkstra = (matrix, start, end) => {
    const distances = {};
    const visited = new Set();
    const previous = {};

    Object.keys(matrix).forEach((node) => {
      distances[node] = Infinity;
    });
    distances[start] = 0;

    while (visited.size < Object.keys(matrix).length) {
      let currentNode = null;
      let currentDistance = Infinity;
      for (let node in distances) {
        if (!visited.has(node) && distances[node] < currentDistance) {
          currentNode = node;
          currentDistance = distances[node];
        }
      }

      if (currentNode === null || currentNode === end) break;
      visited.add(currentNode);

      for (let neighbor in matrix[currentNode]) {
        const distance = matrix[currentNode][neighbor];
        if (distance !== Infinity && !visited.has(neighbor)) {
          const totalDistance = distances[currentNode] + distance;
          if (totalDistance < distances[neighbor]) {
            distances[neighbor] = totalDistance;
            previous[neighbor] = currentNode;
          }
        }
      }
    }

    let path = [];
    let node = end;
    while (node !== undefined) {
      path.unshift(node);
      node = previous[node];
    }
    return { distance: distances[end], path };
  };

  const optimizeMultiPickup = () => {
    let distanceMatrix = getAdjustedDistanceMatrix();
    let loadData = JSON.parse(JSON.stringify(dailyData));
    let allRoutes = [];
    let totalCost = 0;

    let remaining = Object.entries(loadData).filter(
      ([_, data]) => data.load > 0
    );

    while (remaining.length > 0) {
      let truckLoad = 0;
      let route = [];
      let visited = [];
      let currentLoc = "kolappally";
      let progressMade = false;

      while (truckLoad < truckCapacity && remaining.length > 0) {
        let nextLoc = null;
        let minDist = Infinity;

        for (let [loc, data] of remaining) {
          if (!visited.includes(loc)) {
            let { distance } = dijkstra(distanceMatrix, currentLoc, loc);
            if (distance < minDist) {
              minDist = distance;
              nextLoc = loc;
            }
          }
        }

        if (nextLoc && minDist !== Infinity) {
          let canTake = Math.min(
            loadData[nextLoc].load,
            truckCapacity - truckLoad
          );
          if (canTake > 0) {
            truckLoad += canTake;
            loadData[nextLoc].load -= canTake;
            route.push({ location: nextLoc, quantity: canTake });
            visited.push(nextLoc);
            currentLoc = nextLoc;
            progressMade = true;
          }
        } else {
          break;
        }

        remaining = Object.entries(loadData).filter(
          ([_, data]) => data.load > 0
        );
      }

      if (!progressMade) break;

      let fullPath = [
        "kolappally",
        ...route.map((r) => r.location),
        "kolappally",
      ];
      let totalDist = 0;

      for (let i = 0; i < fullPath.length - 1; i++) {
        totalDist += dijkstra(
          distanceMatrix,
          fullPath[i],
          fullPath[i + 1]
        ).distance;
      }

      let fuelCost = (totalDist / mileage) * costPerLiter;

      let labourCost = 0;
      for (let stop of route) {
        const fullLoad = stop.quantity;
        const labourRate = dailyData[stop.location].labour;
        const labourPerKg = labourRate / dailyData[stop.location].load;
        labourCost += labourPerKg * fullLoad;
      }

      const routeCost = fuelCost + labourCost;
      totalCost += routeCost;

      allRoutes.push({ route, truckLoad, truckCost: routeCost.toFixed(2) });
    }

    const totalKg = allRoutes.reduce((sum, truck) => sum + truck.truckLoad, 0);
    return {
      totalCost: totalCost.toFixed(2),
      costPerKg: totalKg ? (totalCost / totalKg).toFixed(2) : "0.00",
      trucksUsed: allRoutes.length,
      allocations: allRoutes,
    };
  };

  const handleInputChange = (location, field, value) => {
    setDailyData((prevData) => ({
      ...prevData,
      [location]: {
        ...prevData[location],
        [field]: parseFloat(value) || 0,
      },
    }));
  };

  const handleRouteAvailability = (from, to, available) => {
    const key1 = `${from}-${to}`;
    const key2 = `${to}-${from}`;
    setRouteAvailability((prev) => {
      const updated = {
        ...prev,
        [key1]: available,
        [key2]: available,
      };
      const adjusted = getAdjustedDistanceMatrix();
      setAdjustedMatrix(adjusted);
      return updated;
    });
  };

  const optimizeRoute = () => {
    const hasLoad = Object.values(dailyData).some((data) => data.load > 0);
    if (!hasLoad) {
      alert("Please enter at least one non-zero load to run the optimizer.");
      return;
    }
    const optimized = optimizeMultiPickup();
    setResult(optimized);
  };

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-center">
        Tea Transport Optimizer
      </h1>

      <div className="mb-4 border rounded-lg shadow-sm p-4">
        <h2 className="text-xl font-semibold mb-2">Enter Daily Inputs</h2>
        <table className="w-full border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 text-left">Location</th>
              <th className="border p-2">Load (kg)</th>
              <th className="border p-2">Labour (₹)</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(dailyData).map((location) => (
              <tr key={location}>
                <td className="border p-2 capitalize font-medium">
                  {location}
                </td>
                <td className="border p-2">
                  <input
                    type="number"
                    className="w-full border p-1 rounded"
                    onChange={(e) =>
                      handleInputChange(location, "load", e.target.value)
                    }
                  />
                </td>
                <td className="border p-2">
                  <input
                    type="number"
                    className="w-full border p-1 rounded"
                    onChange={(e) =>
                      handleInputChange(location, "labour", e.target.value)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="text-xl font-semibold mt-6 mb-2">Route Availability</h2>
        <table className="w-full border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">From</th>
              <th className="border p-2">To</th>
              <th className="border p-2">Available</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(originalDistanceMatrix).flatMap((from) =>
              Object.keys(originalDistanceMatrix[from])
                .filter((to) => from < to)
                .map((to) => (
                  <tr key={`${from}-${to}`} className="hover:bg-gray-50">
                    <td className="border p-2 font-medium capitalize">
                      {from}
                    </td>
                    <td className="border p-2 font-medium capitalize">{to}</td>
                    <td className="border p-2 text-center">
                      <input
                        type="checkbox"
                        checked={routeAvailability[`${from}-${to}`] !== false}
                        onChange={(e) =>
                          handleRouteAvailability(from, to, e.target.checked)
                        }
                      />
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>

        {adjustedMatrix && (
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Adjusted Distance Matrix</h3>
            <table className="table-auto border-collapse border border-gray-400">
              <thead>
                <tr>
                  <th className="border p-1">From / To</th>
                  {Object.keys(adjustedMatrix).map((col) => (
                    <th key={col} className="border p-1 capitalize">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(adjustedMatrix).map(([from, toObj]) => (
                  <tr key={from}>
                    <td className="border p-1 font-semibold capitalize">
                      {from}
                    </td>
                    {Object.keys(adjustedMatrix).map((to) => (
                      <td key={to} className="border p-1">
                        {toObj[to] === Infinity ? "—" : toObj[to]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          className="mt-3 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
          onClick={optimizeRoute}
        >
          Optimize Route
        </button>
      </div>

      {result && (
        <div className="border rounded-lg shadow-sm p-4 mb-6">
          <h2 className="text-xl font-semibold mb-2">
            Optimized Transport Plan
          </h2>
          <p>Total Transport Cost: ₹{result.totalCost}</p>
          <p>Average Cost per Kg: ₹{result.costPerKg}</p>
          <p>Total Trucks Used: {result.trucksUsed}</p>

          <div className="mt-4">
            <h3 className="font-semibold mb-2">Truck Allocations</h3>
            <ul className="list-disc list-inside space-y-1">
              {result.allocations.map((truck, i) => (
                <li key={i}>
                  Truck {i + 1}: Kolappally →{" "}
                  {truck.route
                    .map((r) => `${r.location} (${r.quantity}kg)`)
                    .join(" → ")}{" "}
                  → Kolappally (Cost: ₹{truck.truckCost})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeaTransportOptimizer;
